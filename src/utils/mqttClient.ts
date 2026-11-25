/**
 * Lightweight Zero-Dependency MQTT 3.1.1 WebSocket Client for ThrottleLog Crew Radar
 * 
 * Connects directly to global public high-availability MQTT brokers over WSS
 * (HiveMQ / EMQX) without requiring native packages, credentials, or backend servers.
 * Enables zero-setup, instant cross-device peer discovery for riders across mobile
 * cellular data and Wi-Fi networks.
 */

export type MqttConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MqttWillOptions {
  topic: string;
  payload: any;
  qos?: 0 | 1;
  retain?: boolean;
}

export interface MqttClientOptions {
  brokerUrls?: string[];
  clientId?: string;
  will?: MqttWillOptions;
  onMessage?: (topic: string, data: any) => void;
  onStatusChange?: (status: MqttConnectionStatus, detail?: string) => void;
  keepAliveSeconds?: number;
}

export type DecodedMqttFrame =
  | { type: 'CONNACK'; returnCode: number }
  | { type: 'PINGRESP' }
  | { type: 'SUBACK'; packetId: number; returnCodes: number[] }
  | { type: 'PUBLISH'; qos: number; topic: string; packetId?: number; payload: any }
  | { type: 'OTHER'; packetType: number };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const MAX_RX_BUFFER_BYTES = 512 * 1024;

export function encodeMqttRemainingLength(length: number): number[] {
  const bytes: number[] = [];
  let l = length;
  do {
    let digit = l % 128;
    l = Math.floor(l / 128);
    if (l > 0) digit |= 0x80;
    bytes.push(digit);
  } while (l > 0);
  return bytes;
}

export function encodeMqttConnectPacket(
  clientId: string,
  keepAlive: number,
  will: MqttWillOptions | null = null
): Uint8Array {
  const clientIdBytes = textEncoder.encode(clientId);
  let connectFlags = 0x02; // Clean Session

  let willTopicBytes: Uint8Array | null = null;
  let willPayloadBytes: Uint8Array | null = null;

  if (will && will.topic) {
    willTopicBytes = textEncoder.encode(will.topic);
    const willStr = typeof will.payload === 'string' ? will.payload : JSON.stringify(will.payload);
    willPayloadBytes = textEncoder.encode(willStr);
    connectFlags |= 0x04; // Will Flag
    if (will.qos === 1) connectFlags |= 0x08;
    if (will.retain) connectFlags |= 0x20;
  }

  const variableHeader = [
    0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // 'MQTT'
    0x04,                               // Protocol Level 4 (v3.1.1)
    connectFlags,
    (keepAlive >> 8) & 0xff,
    keepAlive & 0xff,
  ];

  const payloadParts: number[] = [
    (clientIdBytes.length >> 8) & 0xff,
    clientIdBytes.length & 0xff,
    ...clientIdBytes,
  ];

  if (willTopicBytes && willPayloadBytes) {
    payloadParts.push(
      (willTopicBytes.length >> 8) & 0xff,
      willTopicBytes.length & 0xff,
      ...willTopicBytes,
      (willPayloadBytes.length >> 8) & 0xff,
      willPayloadBytes.length & 0xff,
      ...willPayloadBytes,
    );
  }

  const remaining = new Uint8Array([...variableHeader, ...payloadParts]);
  const fixedHeader = new Uint8Array([0x10, ...encodeMqttRemainingLength(remaining.length)]);
  const packet = new Uint8Array(fixedHeader.length + remaining.length);
  packet.set(fixedHeader, 0);
  packet.set(remaining, fixedHeader.length);
  return packet;
}

/**
 * Decodes one or more MQTT 3.1.1 control packets from a combined byte stream,
 * returning decoded frames and any trailing incomplete bytes for future WS chunks.
 */
export function decodeMqttFrames(buf: Uint8Array): {
  frames: DecodedMqttFrame[];
  remainder: Uint8Array;
  malformed: boolean;
} {
  const frames: DecodedMqttFrame[] = [];
  let cursor = 0;

  while (cursor < buf.length) {
    if (cursor + 2 > buf.length) {
      return { frames, remainder: buf.slice(cursor), malformed: false };
    }

    const packetType = buf[cursor] >> 4;
    let offset = cursor + 1;
    let multiplier = 1;
    let remLen = 0;
    let varBytes = 0;
    let digit = 0;
    let incomplete = false;

    do {
      if (offset >= buf.length) {
        incomplete = true;
        break;
      }
      digit = buf[offset++];
      remLen += (digit & 0x7f) * multiplier;
      multiplier *= 128;
      varBytes++;
      if (varBytes > 4) {
        return { frames, remainder: new Uint8Array(0), malformed: true };
      }
    } while ((digit & 0x80) !== 0);

    if (incomplete) {
      return { frames, remainder: buf.slice(cursor), malformed: false };
    }

    const varHeaderStart = offset;
    const packetEnd = varHeaderStart + remLen;
    if (packetEnd > buf.length) {
      return { frames, remainder: buf.slice(cursor), malformed: false };
    }

    if (packetType === 13) {
      frames.push({ type: 'PINGRESP' });
    } else if (packetType === 2) {
      if (remLen >= 2 && varHeaderStart + 2 <= packetEnd) {
        frames.push({ type: 'CONNACK', returnCode: buf[varHeaderStart + 1] });
      }
    } else if (packetType === 9) {
      if (remLen >= 3 && varHeaderStart + 3 <= packetEnd) {
        const packetId = (buf[varHeaderStart] << 8) | buf[varHeaderStart + 1];
        const returnCodes = Array.from(buf.subarray(varHeaderStart + 2, packetEnd));
        frames.push({ type: 'SUBACK', packetId, returnCodes });
      }
    } else if (packetType === 3) {
      if (offset + 2 <= packetEnd) {
        const qos = (buf[cursor] & 0x06) >> 1;
        const topicLen = (buf[offset] << 8) | buf[offset + 1];
        offset += 2;
        if (offset + topicLen <= packetEnd) {
          const topic = textDecoder.decode(buf.subarray(offset, offset + topicLen));
          offset += topicLen;

          let packetId: number | undefined;
          if (qos > 0) {
            if (offset + 2 <= packetEnd) {
              packetId = (buf[offset] << 8) | buf[offset + 1];
              offset += 2;
            } else {
              cursor = packetEnd;
              continue;
            }
          }

          const payloadStr = textDecoder.decode(buf.subarray(offset, packetEnd));
          let parsed: any;
          try {
            parsed = JSON.parse(payloadStr);
          } catch {
            parsed = payloadStr;
          }
          frames.push({ type: 'PUBLISH', qos, topic, packetId, payload: parsed });
        }
      }
    } else {
      frames.push({ type: 'OTHER', packetType });
    }

    cursor = packetEnd;
  }

  return { frames, remainder: new Uint8Array(0), malformed: false };
}

export class SimpleMqttClient {
  private brokerUrls: string[];
  private currentBrokerIndex = 0;
  private clientId: string;
  private will: MqttWillOptions | null;
  private onMessage: (topic: string, data: any) => void;
  private onStatusChange: (status: MqttConnectionStatus, detail?: string) => void;
  private keepAlive: number;

  private ws: WebSocket | null = null;
  private subscribedTopics = new Set<string>();
  private pendingSubacks = new Map<number, string>();
  private nextPacketId = 1;
  private rxBuffer: Uint8Array = new Uint8Array(0);
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private connackTimeout: any = null;
  private onlineDebounceTimer: any = null;
  private reconnectAttempts = 0;
  private consecutiveFailures = 0;
  private isDestroyed = false;

  private lastPingSent = 0;
  private isAwaitingPong = false;
  private boundOnlineHandler: any = null;

  private encoder = textEncoder;
  private pendingCriticalQueue: Array<{ topic: string; payload: any; timestamp: number }> = [];

  constructor(options: MqttClientOptions = {}) {
    this.brokerUrls = options.brokerUrls && options.brokerUrls.length > 0
      ? options.brokerUrls
      : [
          'wss://broker.hivemq.com:8884/mqtt',
          'wss://broker.emqx.io:8084/mqtt',
        ];
    this.clientId = options.clientId || 'rider_' + Math.random().toString(36).substring(2, 9);
    this.will = options.will || null;
    this.onMessage = options.onMessage || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.keepAlive = options.keepAliveSeconds || 30;

    if (typeof window !== 'undefined') {
      this.boundOnlineHandler = () => {
        clearTimeout(this.onlineDebounceTimer);
        this.onlineDebounceTimer = setTimeout(() => {
          if (this.isDestroyed) return;
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.reconnectAttempts = 0;
            this.connect();
          }
        }, 1200);
      };
      window.addEventListener('online', this.boundOnlineHandler);
    }
  }

  public setWill(will: MqttWillOptions | null): void {
    this.will = will;
  }

  private allocatePacketId(): number {
    const id = this.nextPacketId;
    this.nextPacketId = this.nextPacketId >= 65535 ? 1 : this.nextPacketId + 1;
    return id;
  }

  private encodeRemainingLength(length: number): number[] {
    return encodeMqttRemainingLength(length);
  }

  public connect(): void {
    if (this.isDestroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const currentUrl = this.brokerUrls[this.currentBrokerIndex % this.brokerUrls.length];
    this.onStatusChange('connecting', `Connecting to radar relay (${new URL(currentUrl).hostname})...`);

    try {
      const socket = new WebSocket(currentUrl, 'mqtt');
      socket.binaryType = 'arraybuffer';
      this.ws = socket;
      this.rxBuffer = new Uint8Array(0);
      this.pendingSubacks.clear();

      socket.onopen = () => {
        if (this.isDestroyed || this.ws !== socket) {
          try { socket.close(); } catch {}
          return;
        }
        this.reconnectAttempts = 0;
        clearTimeout(this.connackTimeout);
        this.connackTimeout = setTimeout(() => {
          if (!this.isDestroyed && this.ws === socket) {
            console.warn('MQTT CONNACK handshake timeout (6s) - forcing socket close');
            try { socket.close(); } catch {}
          }
        }, 6000);
        const packet = encodeMqttConnectPacket(this.clientId, this.keepAlive, this.will);
        try {
          socket.send(packet);
        } catch {}
      };

      socket.onmessage = (event: MessageEvent) => {
        if (this.isDestroyed || this.ws !== socket) return;
        const incoming = event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : (event.data instanceof Uint8Array ? event.data : new Uint8Array(0));
        if (incoming.length === 0) return;

        let combined: Uint8Array;
        if (this.rxBuffer.length > 0) {
          if (this.rxBuffer.length + incoming.length > MAX_RX_BUFFER_BYTES) {
            this.rxBuffer = new Uint8Array(0);
            combined = incoming;
          } else {
            combined = new Uint8Array(this.rxBuffer.length + incoming.length);
            combined.set(this.rxBuffer, 0);
            combined.set(incoming, this.rxBuffer.length);
          }
        } else {
          combined = incoming;
        }

        const decoded = decodeMqttFrames(combined);
        this.rxBuffer = decoded.malformed ? new Uint8Array(0) : decoded.remainder;

        for (const frame of decoded.frames) {
          this.isAwaitingPong = false;

          if (frame.type === 'PINGRESP') {
            continue;
          }

          if (frame.type === 'CONNACK') {
            clearTimeout(this.connackTimeout);
            if (frame.returnCode === 0x00) {
              this.consecutiveFailures = 0;
              this.onStatusChange('connected', 'Live on Global Crew Radar');
              this.startPing();
              this.subscribedTopics.forEach(topic => this.sendSubscribe(topic));

              const now = Date.now();
              const toFlush = this.pendingCriticalQueue.filter(m => (now - m.timestamp) < 90000);
              this.pendingCriticalQueue = [];
              toFlush.forEach(item => {
                this.publish(item.topic, item.payload, true);
              });
            } else {
              this.onStatusChange('error', `Connection rejected (code ${frame.returnCode})`);
            }
          } else if (frame.type === 'SUBACK') {
            const topic = this.pendingSubacks.get(frame.packetId);
            this.pendingSubacks.delete(frame.packetId);
            if (frame.returnCodes.some(code => code === 0x80)) {
              console.warn('MQTT subscription rejected for topic:', topic);
            }
          } else if (frame.type === 'PUBLISH') {
            if (frame.qos === 1 && frame.packetId !== undefined && socket.readyState === WebSocket.OPEN) {
              const puback = new Uint8Array([0x40, 0x02, (frame.packetId >> 8) & 0xff, frame.packetId & 0xff]);
              try {
                socket.send(puback);
              } catch {}
            }
            try {
              this.onMessage(frame.topic, frame.payload);
            } catch (e) {
              console.warn('MQTT onMessage handler error', e);
            }
          }
        }
      };

      socket.onerror = () => {
        if (this.isDestroyed || this.ws !== socket) return;
        this.onStatusChange('error', 'Radar relay network error');
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.ws = null;
        this.rxBuffer = new Uint8Array(0);
        this.stopPing();
        clearTimeout(this.connackTimeout);
        if (this.isDestroyed) return;

        this.onStatusChange('disconnected', 'Radar relay reconnecting...');
        this.consecutiveFailures++;
        this.reconnectAttempts++;
        // Failover to backup broker only after 3 consecutive failures on current broker,
        // and periodically retry primary (index 0) so squad mates avoid un-bridged split-brain.
        if (this.consecutiveFailures >= 3) {
          this.consecutiveFailures = 0;
          this.currentBrokerIndex = (this.currentBrokerIndex + 1) % this.brokerUrls.length;
        }
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 12000);
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, delay);
      };
    } catch {
      this.onStatusChange('error', 'Unable to initialize radar socket');
    }
  }

  private sendSubscribe(topic: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const packetId = this.allocatePacketId();
    const topicBytes = this.encoder.encode(topic);
    const body = new Uint8Array([
      (packetId >> 8) & 0xff,
      packetId & 0xff,
      (topicBytes.length >> 8) & 0xff,
      topicBytes.length & 0xff,
      ...topicBytes,
      0x00, // Requested QoS 0
    ]);

    this.pendingSubacks.set(packetId, topic);
    const header = new Uint8Array([0x82, ...this.encodeRemainingLength(body.length)]);
    const packet = new Uint8Array(header.length + body.length);
    packet.set(header, 0);
    packet.set(body, header.length);
    try {
      this.ws.send(packet);
    } catch {
      this.pendingSubacks.delete(packetId);
    }
  }

  public subscribe(topic: string): void {
    this.subscribedTopics.add(topic);
    this.sendSubscribe(topic);
  }

  public unsubscribe(topic: string): void {
    this.subscribedTopics.delete(topic);
  }

  public publish(topic: string, payload: any, isCritical?: boolean): void {
    const isCriticalMessage = isCritical !== undefined ? isCritical :
      (typeof payload === 'object' && payload !== null && (payload.type === 'SOS_PING' || payload.type === 'CALLOUT' || payload.type === 'ROUTE_SHARE'));

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (isCriticalMessage) {
        this.pendingCriticalQueue.push({ topic, payload, timestamp: Date.now() });
        if (this.pendingCriticalQueue.length > 10) {
          this.pendingCriticalQueue.shift();
        }
      }
      return;
    }

    try {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const topicBytes = this.encoder.encode(topic);
      const payloadBytes = this.encoder.encode(payloadStr);

      const body = new Uint8Array(2 + topicBytes.length + payloadBytes.length);
      body[0] = (topicBytes.length >> 8) & 0xff;
      body[1] = topicBytes.length & 0xff;
      body.set(topicBytes, 2);
      body.set(payloadBytes, 2 + topicBytes.length);

      const header = new Uint8Array([0x30, ...this.encodeRemainingLength(body.length)]);
      const packet = new Uint8Array(header.length + body.length);
      packet.set(header, 0);
      packet.set(body, header.length);

      this.ws.send(packet);
    } catch (err) {
      console.warn('Failed publishing MQTT packet', err);
      if (isCriticalMessage) {
        this.pendingCriticalQueue.push({ topic, payload, timestamp: Date.now() });
      }
    }
  }

  private startPing(): void {
    this.stopPing();
    this.isAwaitingPong = false;
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      // Check if previous ping timed out (zombie socket in mountain dead zone)
      if (this.isAwaitingPong && (now - this.lastPingSent) >= 8000) {
        console.warn('MQTT ping watchdog timeout (8s) - reconnecting');
        this.stopPing();
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.consecutiveFailures = 0;
          this.currentBrokerIndex = (this.currentBrokerIndex + 1) % this.brokerUrls.length;
        }
        const staleWs = this.ws;
        this.ws = null;
        this.rxBuffer = new Uint8Array(0);
        if (staleWs) {
          try { staleWs.close(); } catch {}
        }
        this.connect();
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSent = now;
        this.isAwaitingPong = true;
        try {
          this.ws.send(new Uint8Array([0xc0, 0x00]));
        } catch {}
      }
    }, 6000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.isAwaitingPong = false;
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stopPing();
    clearTimeout(this.connackTimeout);
    clearTimeout(this.reconnectTimeout);
    clearTimeout(this.onlineDebounceTimer);
    if (typeof window !== 'undefined' && this.boundOnlineHandler) {
      window.removeEventListener('online', this.boundOnlineHandler);
    }
    const staleWs = this.ws;
    this.ws = null;
    this.rxBuffer = new Uint8Array(0);
    this.pendingSubacks.clear();
    if (staleWs) {
      try {
        staleWs.close();
      } catch {}
    }
  }
}
