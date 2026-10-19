/**
 * Lightweight Zero-Dependency MQTT 3.1.1 WebSocket Client for ThrottleLog Crew Radar
 * 
 * Connects directly to global public high-availability MQTT brokers over WSS
 * (HiveMQ / EMQX) without requiring native packages, credentials, or backend servers.
 * Enables zero-setup, instant cross-device peer discovery for riders across mobile
 * cellular data and Wi-Fi networks.
 */

export type MqttConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MqttClientOptions {
  brokerUrls?: string[];
  clientId?: string;
  onMessage?: (topic: string, data: any) => void;
  onStatusChange?: (status: MqttConnectionStatus, detail?: string) => void;
  keepAliveSeconds?: number;
}

export class SimpleMqttClient {
  private brokerUrls: string[];
  private currentBrokerIndex = 0;
  private clientId: string;
  private onMessage: (topic: string, data: any) => void;
  private onStatusChange: (status: MqttConnectionStatus, detail?: string) => void;
  private keepAlive: number;

  private ws: WebSocket | null = null;
  private subscribedTopics = new Set<string>();
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;

  private lastPingSent = 0;
  private isAwaitingPong = false;
  private boundOnlineHandler: any = null;

  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(options: MqttClientOptions = {}) {
    this.brokerUrls = options.brokerUrls && options.brokerUrls.length > 0
      ? options.brokerUrls
      : [
          'wss://broker.hivemq.com:8884/mqtt',
          'wss://broker.emqx.io:8084/mqtt',
        ];
    this.clientId = options.clientId || 'rider_' + Math.random().toString(36).substring(2, 9);
    this.onMessage = options.onMessage || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.keepAlive = options.keepAliveSeconds || 30;

    if (typeof window !== 'undefined') {
      let onlineDebounceTimer: any = null;
      this.boundOnlineHandler = () => {
        clearTimeout(onlineDebounceTimer);
        onlineDebounceTimer = setTimeout(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.reconnectAttempts = 0;
            this.connect();
          }
        }, 1200);
      };
      window.addEventListener('online', this.boundOnlineHandler);
    }
  }

  private encodeRemainingLength(length: number): number[] {
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

  public connect(): void {
    if (this.isDestroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const currentUrl = this.brokerUrls[this.currentBrokerIndex % this.brokerUrls.length];
    this.onStatusChange('connecting', `Connecting to radar relay (${new URL(currentUrl).hostname})...`);

    try {
      this.ws = new WebSocket(currentUrl, 'mqtt');
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        if (this.isDestroyed) {
          this.ws?.close();
          return;
        }
        this.reconnectAttempts = 0;

        // Send MQTT 3.1.1 CONNECT packet
        const clientIdBytes = this.encoder.encode(this.clientId);
        const variableHeader = [
          0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // 'MQTT'
          0x04,                               // Protocol Level 4 (v3.1.1)
          0x02,                               // Clean Session flag
          (this.keepAlive >> 8) & 0xff,       // Keepalive MSB
          this.keepAlive & 0xff,              // Keepalive LSB
        ];

        const payload = [
          (clientIdBytes.length >> 8) & 0xff,
          clientIdBytes.length & 0xff,
          ...clientIdBytes,
        ];

        const remaining = new Uint8Array([...variableHeader, ...payload]);
        const fixedHeader = new Uint8Array([0x10, ...this.encodeRemainingLength(remaining.length)]);

        const packet = new Uint8Array(fixedHeader.length + remaining.length);
        packet.set(fixedHeader, 0);
        packet.set(remaining, fixedHeader.length);

        this.ws?.send(packet);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (this.isDestroyed) return;
        const buf = new Uint8Array(event.data);
        if (buf.length === 0) return;

        const packetType = buf[0] >> 4;
        this.isAwaitingPong = false;

        if (packetType === 13) {
          // PINGRESP received from broker: socket is healthy & responsive
          return;
        }

        if (packetType === 2) {
          // CONNACK
          const returnCode = buf[3];
          if (returnCode === 0x00) {
            this.onStatusChange('connected', 'Live on Global Crew Radar');
            this.startPing();
            // Re-subscribe all active topics
            this.subscribedTopics.forEach(topic => this.sendSubscribe(topic));
          } else {
            this.onStatusChange('error', `Connection rejected (code ${returnCode})`);
          }
        } else if (packetType === 3) {
          // PUBLISH packet received
          try {
            const qos = (buf[0] & 0x06) >> 1;
            let offset = 1;
            let multiplier = 1;
            let remLen = 0;
            let digit: number;
            do {
              digit = buf[offset++];
              remLen += (digit & 0x7f) * multiplier;
              multiplier *= 128;
            } while ((digit & 0x80) !== 0 && offset < buf.length);

            const varHeaderStart = offset;
            const endOfPacket = Math.min(buf.length, varHeaderStart + remLen);

            const topicLen = (buf[offset] << 8) | buf[offset + 1];
            offset += 2;
            const topic = this.decoder.decode(buf.subarray(offset, offset + topicLen));
            offset += topicLen;

            // If QoS > 0, MQTT 3.1.1 inserts a 2-byte Packet Identifier here
            if (qos > 0 && offset + 2 <= endOfPacket) {
              const packetId = (buf[offset] << 8) | buf[offset + 1];
              offset += 2;
              // Acknowledge QoS 1 to stop broker retry flood
              if (qos === 1 && this.ws && this.ws.readyState === WebSocket.OPEN) {
                const puback = new Uint8Array([0x40, 0x02, (packetId >> 8) & 0xff, packetId & 0xff]);
                try {
                  this.ws.send(puback);
                } catch {}
              }
            }

            const payloadBytes = buf.subarray(offset, endOfPacket);
            const payloadStr = this.decoder.decode(payloadBytes);

            let parsed: any;
            try {
              parsed = JSON.parse(payloadStr);
            } catch {
              parsed = payloadStr;
            }

            this.onMessage(topic, parsed);
          } catch (e) {
            console.warn('Failed parsing MQTT packet', e);
          }
        }
      };

      this.ws.onerror = () => {
        this.onStatusChange('error', 'Radar relay network error');
      };

      this.ws.onclose = () => {
        this.stopPing();
        if (this.isDestroyed) return;

        this.onStatusChange('disconnected', 'Radar relay reconnecting...');
        this.currentBrokerIndex++; // Try failover broker on next attempt

        // Exponential backoff reconnect
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 12000);
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, delay);
      };
    } catch (err) {
      this.onStatusChange('error', 'Unable to initialize radar socket');
    }
  }

  private sendSubscribe(topic: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const topicBytes = this.encoder.encode(topic);
    const body = new Uint8Array([
      0x00, 0x01, // Packet ID
      (topicBytes.length >> 8) & 0xff,
      topicBytes.length & 0xff,
      ...topicBytes,
      0x00, // Requested QoS 0
    ]);

    const header = new Uint8Array([0x82, ...this.encodeRemainingLength(body.length)]);
    const packet = new Uint8Array(header.length + body.length);
    packet.set(header, 0);
    packet.set(body, header.length);
    this.ws.send(packet);
  }

  public subscribe(topic: string): void {
    this.subscribedTopics.add(topic);
    this.sendSubscribe(topic);
  }

  public unsubscribe(topic: string): void {
    this.subscribedTopics.delete(topic);
  }

  public publish(topic: string, payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

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
    }
  }

  private startPing(): void {
    this.stopPing();
    this.isAwaitingPong = false;
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      // Check if previous ping timed out (zombie socket in mountain dead zone)
      if (this.isAwaitingPong && (now - this.lastPingSent) >= 8000) {
        console.warn('MQTT ping watchdog timeout (8s) - forcing broker failover reconnect');
        this.stopPing();
        if (this.ws) {
          try { this.ws.close(); } catch {}
          this.ws = null;
        }
        this.currentBrokerIndex++;
        this.connect();
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send MQTT PINGREQ
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
    clearTimeout(this.reconnectTimeout);
    if (typeof window !== 'undefined' && this.boundOnlineHandler) {
      window.removeEventListener('online', this.boundOnlineHandler);
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
