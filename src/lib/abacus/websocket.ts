import type { AbacusWebsocketProtocol } from '@/constants/abacus';
import type { TradingViewBar } from '@/constants/candles';
import { isDev } from '@/constants/networks';
import {
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  OUTGOING_PING_MESSAGE,
  PONG_MESSAGE_TYPE,
} from '@/constants/websocket';

import { lastSuccessfulWebsocketRequestByOrigin } from '@/hooks/useAnalytics';

import { testFlags } from '@/lib/testFlags';
import { subscriptionsByChannelId } from '@/lib/tradingView/dydxfeed/cache';
import { mapCandle } from '@/lib/tradingView/utils';

import { log } from '../telemetry';

const RECONNECT_INTERVAL_MS = 10_000;

class AbacusWebsocket implements Omit<AbacusWebsocketProtocol, '__doNotUseOrImplementIt'> {
  private socket: WebSocket | null = null;
  private url: string | null = null;
  private connectedCallback: ((p0: boolean) => void) | null = null;
  private receivedCallback: ((p0: string) => void) | null = null;

  private pingPongTimer?: NodeJS.Timer;
  private disconnectTimer?: NodeJS.Timer;
  private currentCandleId: string | undefined;

  connect(url: string, connected: (p0: boolean) => void, received: (p0: string) => void): void {
    this.url = url;
    this.connectedCallback = connected;
    this.receivedCallback = received;
    this._initializeSocket();
  }

  disconnect(): void {
    this._clearSocket();
  }

  send(message: string): void {
    try {
      this.socket?.send(message);
    } catch (error) {
      log('AbacusWebsocketProtocol/send', error, { message });
    }
  }

  handleCandlesSubscription = ({
    channelId,
    subscribe,
  }: {
    channelId: string;
    subscribe: boolean;
  }) => {
    if (!this.socket) return;

    if (subscribe) {
      this.socket.send(
        JSON.stringify({
          type: 'subscribe',
          channel: 'v4_candles',
          id: channelId,
          batched: true,
        })
      );

      this.currentCandleId = channelId;
    } else {
      this.socket.send(
        JSON.stringify({
          type: 'unsubscribe',
          channel: 'v4_candles',
          id: channelId,
        })
      );

      if (this.currentCandleId === channelId) {
        this.currentCandleId = undefined;
      }
    }
  };

  private _initializeSocket = (): void => {
    if (!this.url || !this.connectedCallback || !this.receivedCallback) return;
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.pingPongTimer = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(OUTGOING_PING_MESSAGE);
          }
        }, PING_INTERVAL_MS);
        this._setDisconnectTimeout();

        this._setReconnectInterval();

        if (this.currentCandleId) {
          this.handleCandlesSubscription({ channelId: this.currentCandleId, subscribe: true });
        }
      } else if (
        this.socket?.readyState === WebSocket.CLOSED ||
        this.socket?.readyState === WebSocket.CLOSING
      ) {
        this.socket = null;
      }
    };

    this.socket.onmessage = (m) => {
      try {
        const parsedMessage = JSON.parse(m.data);

        if (parsedMessage?.type === PONG_MESSAGE_TYPE) {
          clearTimeout(this.disconnectTimer);
          this._setDisconnectTimeout();
        } else {
          let shouldProcess = true;

          switch (parsedMessage?.channel) {
            case 'v4_orderbook': {
              shouldProcess = import.meta.env.VITE_ABACUS_PROCESS_ORDERBOOK !== '0';
              break;
            }
            case 'v4_candles': {
              shouldProcess = false;
              const { id, contents } = parsedMessage;

              if (id && contents) {
                const subscriptionItem = subscriptionsByChannelId.get(id);
                const updatedCandle = contents[0];

                if (updatedCandle && subscriptionItem) {
                  const bar: TradingViewBar = mapCandle(updatedCandle);
                  subscriptionItem.lastBar = bar;

                  // send data to every subscriber of that symbol
                  Object.values(subscriptionItem.handlers).forEach((handler: any) =>
                    handler.callback(bar)
                  );
                }
              }

              break;
            }
            case 'v4_markets': {
              if (testFlags.displayInitializingMarkets) {
                shouldProcess = false;
                const { contents } = parsedMessage;

                Object.keys(contents.markets ?? {}).forEach((market: any) => {
                  const status = contents.markets[market].status;
                  if (status === 'INITIALIZING') {
                    contents.markets[market].status = 'ONLINE';
                  }
                });

                this.receivedCallback?.(JSON.stringify(parsedMessage));
              }

              break;
            }
            default: {
              break;
            }
          }

          if (shouldProcess && this.receivedCallback) {
            this.receivedCallback(m.data);
          }
        }

        lastSuccessfulWebsocketRequestByOrigin[new URL(this.url!).origin] = Date.now();
      } catch (error) {
        log('AbacusWebsocketProtocol/onmessage', error);
      }
    };

    this.socket.onclose = (e) => {
      this.connectedCallback?.(false);
      if (!isDev) return;
      console.warn('AbacusStateManager > WS > close > ', e);
    };

    this.socket.onerror = (e) => {
      this.connectedCallback?.(false);
      if (!isDev) return;
      console.error('AbacusStateManager > WS > error > ', e);
    };
  };

  private _clearSocket = (): void => {
    if (!this.url || !this.connectedCallback || !this.receivedCallback) return;
    this.socket?.close();
    this.socket = null;

    clearInterval(this.pingPongTimer);
    delete this.pingPongTimer;

    clearInterval(this.disconnectTimer);
    delete this.disconnectTimer;

    this.connectedCallback(false);
  };

  private _setReconnectInterval = () => {
    setInterval(() => {
      if (
        !this.socket ||
        this.socket.readyState === WebSocket.CLOSED ||
        this.socket.readyState === WebSocket.CLOSING
      ) {
        this._clearSocket();
        this._initializeSocket();
      }
    }, RECONNECT_INTERVAL_MS);
  };

  private _setDisconnectTimeout = () => {
    this.disconnectTimer = setTimeout(() => {
      this._clearSocket();
    }, PONG_TIMEOUT_MS);
  };
}

export default AbacusWebsocket;
