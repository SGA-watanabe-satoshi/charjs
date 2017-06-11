/// <reference path="../../typings/index.d.ts" />

namespace Charjs {

    interface IPeerEvent {
        eventName: string;
        data: any;
    }

    export class PeerConnector {
        private static API_KEY = 'fikef0tx5c3j714i';
        private _peer: PeerJs.Peer = null;
        private _connection: PeerJs.DataConnection = null;
        private _peerId = null;
        private _isOpened = false;
        private _isConnected = false;
        private _peerEvent = {};
        private _peerInitialized = false;

        private static staticPeer: PeerConnector = null;

        static getPeer(apiKey?: string): PeerConnector {
            if (!PeerConnector.staticPeer) {
                PeerConnector.staticPeer = new PeerConnector(apiKey);
            }
            return PeerConnector.staticPeer;

        }

        private constructor(private apiKey: string = PeerConnector.API_KEY) {
        }

        getPeerId() {
            return this._peerId;
        }

        open(): MyQ.Promise<string> {
            let d = MyQ.Deferred.defer<string>();
            if (!this._isOpened && !this._isConnected) {
                this._peer = new Peer({ key: this.apiKey });
                this._peer.on('open', (id) => {
                    this._peerId = id;
                    this._peer.on('connection', (con) => {
                        this._connection = con;
                        con.on('data', (data) => {
                            this.onRecive(data);
                        })
                    })
                    d.resolve(id);
                });
                this._isOpened = true;
            } else {
                d.reject('peer already opened.');
            }
            return d.promise;
        }

        connect(peerId: string): MyQ.Promise<{}> {
            let d = MyQ.Deferred.defer();

            if (!this._isOpened && !this._isConnected) {
                this._peer = new Peer({ key: this.apiKey });
                this._peerId = peerId;
                let con = this._peer.connect(peerId);
                con.on('open', () => {
                    this._connection = con;
                    con.on('data', (data) => {
                        this.onRecive(data);
                    });
                    d.resolve(undefined);
                });
            } else {
                d.reject('peer already opened.');
            }

            return d.promise;
        }

        send(evnetName: string, data: any) {
            if (this._connection) {
                this._connection.send(JSON.stringify({ evnetName, data }));
            }
        }

        setReciveCallback(eventName: string, func: Function) {
            this._peerEvent[eventName] = func;
        }

        onRecive(data: string) {
            let func = null;
            let event: IPeerEvent = JSON.parse(data)
            func = this._peerEvent[event.eventName];
            if (func) func(event.data);
        }
    }

}