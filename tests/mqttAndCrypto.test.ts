import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeMqttRemainingLength,
  encodeMqttConnectPacket,
  decodeMqttFrames,
} from '../src/utils/mqttClient.ts';
import {
  deriveRoomCryptoContext,
  encryptCrewPayload,
  decryptCrewPayload,
} from '../src/utils/crewCrypto.ts';

function encodeVarLen(len: number): number[] {
  return encodeMqttRemainingLength(len);
}

function buildPublishPacket(topic: string, payloadObj: unknown): Uint8Array {
  const enc = new TextEncoder();
  const topicBytes = enc.encode(topic);
  const payloadBytes = enc.encode(JSON.stringify(payloadObj));
  const remLen = 2 + topicBytes.length + payloadBytes.length;
  const header = [0x30, ...encodeVarLen(remLen), (topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff];
  const out = new Uint8Array(header.length + topicBytes.length + payloadBytes.length);
  out.set(header, 0);
  out.set(topicBytes, header.length);
  out.set(payloadBytes, header.length + topicBytes.length);
  return out;
}

test('encodeMqttRemainingLength encodes single and multi-byte varints', () => {
  assert.deepEqual(encodeMqttRemainingLength(0), [0]);
  assert.deepEqual(encodeMqttRemainingLength(127), [127]);
  assert.deepEqual(encodeMqttRemainingLength(300), [0xac, 0x02]);
});

test('encodeMqttConnectPacket builds valid MQTT 3.1.1 packet with Last Will', () => {
  const packet = encodeMqttConnectPacket('rider_42', 30, {
    topic: 'crew/room1/status',
    payload: { offline: true },
    qos: 1,
    retain: true,
  });

  assert.equal(packet[0], 0x10); // CONNECT
  // Variable header starts after 1-byte remaining length (< 128)
  const proto = new TextDecoder().decode(packet.subarray(4, 8));
  assert.equal(proto, 'MQTT');
  assert.equal(packet[8], 0x04); // Level 4
  const connectFlags = packet[9];
  assert.equal(connectFlags & 0x02, 0x02); // Clean Session
  assert.equal(connectFlags & 0x04, 0x04); // Will Flag
  assert.equal(connectFlags & 0x08, 0x08); // Will QoS 1
  assert.equal(connectFlags & 0x20, 0x20); // Will Retain
});

test('decodeMqttFrames handles coalesced frames, TCP split frames, and malformed lengths', () => {
  const connack = new Uint8Array([0x20, 0x02, 0x00, 0x00]);
  const pingresp = new Uint8Array([0xd0, 0x00]);
  const suback = new Uint8Array([0x90, 0x03, 0x00, 0x07, 0x00]);
  const pub = buildPublishPacket('throttlelog/test', { rider: 'Aarav', speed: 72 });

  const combined = new Uint8Array(connack.length + pingresp.length + suback.length + pub.length);
  let offset = 0;
  for (const chunk of [connack, pingresp, suback, pub]) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Split halfway into the PUBLISH packet
  const splitPoint = combined.length - 6;
  const part1 = combined.slice(0, splitPoint);
  const part2 = combined.slice(splitPoint);

  const firstDecode = decodeMqttFrames(part1);
  assert.equal(firstDecode.malformed, false);
  assert.equal(firstDecode.frames.length, 3);
  assert.deepEqual(firstDecode.frames[0], { type: 'CONNACK', returnCode: 0 });
  assert.deepEqual(firstDecode.frames[1], { type: 'PINGRESP' });
  assert.deepEqual(firstDecode.frames[2], { type: 'SUBACK', packetId: 7, returnCodes: [0] });
  assert.ok(firstDecode.remainder.length > 0);

  const rejoined = new Uint8Array(firstDecode.remainder.length + part2.length);
  rejoined.set(firstDecode.remainder, 0);
  rejoined.set(part2, firstDecode.remainder.length);

  const secondDecode = decodeMqttFrames(rejoined);
  assert.equal(secondDecode.malformed, false);
  assert.equal(secondDecode.remainder.length, 0);
  assert.equal(secondDecode.frames.length, 1);
  assert.equal(secondDecode.frames[0].type, 'PUBLISH');
  if (secondDecode.frames[0].type === 'PUBLISH') {
    assert.equal(secondDecode.frames[0].topic, 'throttlelog/test');
    assert.deepEqual(secondDecode.frames[0].payload, { rider: 'Aarav', speed: 72 });
  }

  // Malformed 5-byte remaining length must flag malformed=true
  const bad = new Uint8Array([0x30, 0x80, 0x80, 0x80, 0x80, 0x01]);
  assert.equal(decodeMqttFrames(bad).malformed, true);
});

test('crewCrypto derives deterministic private room contexts and rejects tampered or wrong-room ciphertext', async () => {
  const ctxA1 = await deriveRoomCryptoContext('Sahyadri Dawns');
  const ctxA2 = await deriveRoomCryptoContext('  sahyadri dawns ');
  const ctxB = await deriveRoomCryptoContext('Coastal Cruisers');
  const ctxGlobal = await deriveRoomCryptoContext('GLOBAL');

  assert.equal(ctxA1.isPrivate, true);
  assert.equal(ctxA1.roomHash, ctxA2.roomHash);
  assert.equal(ctxA1.topic, ctxA2.topic);
  assert.notEqual(ctxA1.roomHash, ctxB.roomHash);
  assert.equal(ctxGlobal.isPrivate, false);

  const secretPayload = { riderId: 'r1', lat: 18.44, lon: 73.42, sos: false };
  const envelope = await encryptCrewPayload(ctxA1.secret, ctxA1.roomHash, secretPayload);
  assert.equal(envelope.enc, 1);

  const decrypted = await decryptCrewPayload(ctxA2.secret, ctxA2.roomHash, envelope);
  assert.deepEqual(decrypted, secretPayload);

  // Wrong room secret or roomHash AAD mismatch fails safely with null
  assert.equal(await decryptCrewPayload(ctxB.secret, ctxB.roomHash, envelope), null);
  assert.equal(await decryptCrewPayload(ctxB.secret, ctxA1.roomHash, envelope), null);

  // Tampered ciphertext byte fails GCM auth tag check
  const tampered = { ...envelope, ct: envelope.ct.slice(0, -2) + (envelope.ct.endsWith('AA') ? 'BB' : 'AA') };
  assert.equal(await decryptCrewPayload(ctxA1.secret, ctxA1.roomHash, tampered), null);
});
