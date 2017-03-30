namespace Charjs {
    export class GameMaster {

        static GAME_MASTERS = {};

        constructor(private targetDom, private charSize) {   
        }

        public static GetController(gameName: string, targetDom, charSize: any): GameMaster {
            let master = GameMaster.GAME_MASTERS[gameName];
            if (master) {
                return master;
            }

            master = new GameMaster(targetDom, charSize);
            GameMaster.GAME_MASTERS[gameName] = master;
            return master;
        }

        private _enemys: {[key:string]:IEnemy} = {}
        private _enemyCount = 0;

        private _player: AbstractCharacter = null;
        
        private _isStarting = false;

        public CreateCharInstance<C extends AbstractCharacter>(clz: { new (targetDom, pixSize, position, reverse): C }, position: Position, isReverse = false) : C {

            let char = new clz(this.targetDom, this.charSize, position, isReverse);

            if (char.isEnemy) {
                char._name = 'enemy_' + this._enemyCount;
                this._enemyCount++;
                this._enemys[char._name] = <any>char;
            } else {
                char._name = 'player';
                this._player = char;
            }
            char._gameMaster = this;

            return char;
        }

        public deleteEnemy(char : IEnemy) {
            delete this._enemys[char._name];
            if(Object.keys(this._enemys).length == 0){
                (<any>this._player).gool();
            }
        }

        public getEnemys(): {[name:string]:IEnemy} {
            return this._enemys;
        }

        public init(): void {
            if (this._player) {
                this._player.init();
            }
            for (let name in this._enemys) {
                this._enemys[name].init();
            }
            this.registerCommand();
        }

        public isStarting(): boolean {
            return this._isStarting;
        }

        public registerCommand(): void {
            document.addEventListener('keypress', this.defaultCommand);
        }

        defaultCommand = (e:KeyboardEvent) => {
            if (e.keyCode == 32) {
                if (this._isStarting) {
                    this.stop();
                } else {
                    this.start();
                }
            }
        }

        public start(): void {
            for (let name in this._enemys) {
                this._enemys[name].start();
            }
            if (this._player) {
                this._player.start();
            }

            this._isStarting = true;
        }

        public stop(): void {
            for (let name in this._enemys) {
                this._enemys[name].stop();
            }
            if (this._player) {
                this._player.stop();
            }

            this._isStarting = false;
        }

        public doGameOver(): void {
            for (let name in this._enemys) {
                this._enemys[name].stop();
            }
        }

        public doGool(): void {
            for (let name in this._enemys) {
                this._enemys[name].stop();
            }
        }
    }
}