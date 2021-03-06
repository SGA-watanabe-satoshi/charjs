/// <reference path="abstract_player.ts" />

namespace Charjs {
    export abstract class AbstractMarioWorld extends AbstractPlayer {
        private static STEP = 2;
        private static DEFAULT_SPEED = 2;
        private _runIndex = 0;
        private _currentStep = AbstractMarioWorld.STEP;

        private _yVector = 0;
        private _xVector = 0;
        private _jumpPower = 18;
        private _speed = 0;
        private _gameOverWaitCount = 0;

        private _speedUpTimer = null;
        private _speedDownTimer = null;
        private _squatTimer = null;
        private _gameOverTimer = null;

        private _isJumping = false;
        private _isSpecial = false;

        private _isBraking = false;
        private _isLookup = false;
        private _isSquat = false;
        private _isRight = false;
        private _isLeft = false;
        private _isSpeedUp = false;

        private _rightPushed = false;
        private _leftPushed = false;
        private _attackDirection: Direction = Direction.Right;

        constructor(targetDom, pixSize: number, position: IPosition, direction: Direction = Direction.Right, zIndex = 100, frameInterval = 45) {
            super(targetDom, pixSize, position, direction, true, false, zIndex, frameInterval);
        }

        onAction(): void {
            this.updateEntity();
            switch (this.doHitTest()) {
                case HitStatus.dammage:
                    this.gameOver();
                    break;
                case HitStatus.attack:
                    this.executeRun();
                    this.executeJump();
                    this.draw(11, null, this._attackDirection, Vertical.Up, true);
                    this.stop();
                    setTimeout(() => {
                        this.start();
                    }, this.frameInterval);
                    break;
                case HitStatus.grab:
                    this.moveGrabedEnemy();
                    this.draw(14, null, this._direction, Vertical.Up, true);
                    this.stop();
                    setTimeout(() => {
                        this.start();
                    }, this.frameInterval);
                    break;
                default:
                    let action = this.executeRun();
                    action = this.executeJump() || action;

                    if (action.index === 0) {
                        this.size.widthOffset = 4 * this.pixSize;
                    } else {
                        this.size.widthOffset = 0;
                    }

                    this.draw(action.index, null, action.direction, Vertical.Up, true);
            }
        }

        private checkGrabedEnemysAttack(enemy: IEnemy) {
            if (this._grabedEnemy) {
                let ePos = enemy.getPosition();
                let eSize = enemy.getCharSize()

                let gEnemyPos = this._grabedEnemy.getPosition();
                let gEnemySize = this._grabedEnemy.getCharSize()
                if (gEnemyPos.y > ePos.y + eSize.height)
                    return;
                if (ePos.y > gEnemyPos.y + gEnemySize.height)
                    return;
                if (gEnemyPos.x > ePos.x + eSize.width)
                    return;
                if (ePos.x > gEnemyPos.x + gEnemySize.width)
                    return;

                let grabedEnemyCenter = gEnemyPos.x + gEnemySize.width / 2;
                let enemyCenter = ePos.x + eSize.width / 2;
                enemy.onEnemyAttack(grabedEnemyCenter <= enemyCenter ? Direction.Right : Direction.Left, this._speed * 3);
                this.onPoint(enemy.getPosition(), true);

                this._grabedEnemy.onEnemyAttack(grabedEnemyCenter <= enemyCenter ? Direction.Left : Direction.Right, this._speed * 3);
                this.onPoint(this._grabedEnemy.getPosition(), true);

                this._grabedEnemy = null;
            }
        }

        private _continuousPoint: number = 0;

        private onPoint(targetPos: IPosition, noCountUp?: boolean) {
            PointEffect.drawPoint(this.targetDom, targetPos, this._continuousPoint, this.pixSize);
            if (noCountUp) {
                this.addScore(0);
            } else {
                this.addScore(this._continuousPoint);
                this._continuousPoint++;
            }
        }

        private doHitTest(): HitStatus {
            if (this._gameMaster) {
                let enemys = this._gameMaster.getEnemys();
                for (let name in enemys) {
                    if (enemys[name].isActive() && this._grabedEnemy != enemys[name]) {
                        let ePos = enemys[name].getPosition();
                        let eSize = enemys[name].getCharSize()

                        this.checkGrabedEnemysAttack(enemys[name]);

                        if (this.position.y > ePos.y + eSize.height)
                            continue;
                        if (ePos.y > this.position.y + this.size.height)
                            continue;
                        if (this.position.x > ePos.x + eSize.width)
                            continue;
                        if (ePos.x > this.position.x + this.size.width)
                            continue;

                        if (enemys[name].isStepped()) {
                            if (!this._grabbing) {
                                if (this._isSpecial) {
                                    SpecialEffect.drawSpecial(this.targetDom, enemys[name].getPosition(), this.pixSize);
                                    this.onPoint(enemys[name].getPosition());
                                    enemys[name].onKilled();
                                    this._yVector = 2 * this.pixSize;
                                    return HitStatus.none;
                                } else {
                                    let playerCenter = this.position.x + this.size.width / 2;
                                    let enemyCenter = ePos.x + eSize.width / 2;
                                    this._attackDirection = playerCenter <= enemyCenter ? Direction.Right : Direction.Left;
                                    return enemys[name].onKicked(this._attackDirection, this._speed * 3, this);
                                }
                            } else {
                                this.grabEnemy(enemys[name]);
                                return HitStatus.grab;
                            }
                        }

                        if (this._isJumping && this._yVector < 0) {
                            if (this._isSpecial) {
                                SpecialEffect.drawSpecial(this.targetDom, enemys[name].getPosition(), this.pixSize);
                                this.onPoint(enemys[name].getPosition(), true);
                                enemys[name].onKilled();
                                this._yVector = 2 * this.pixSize;
                            } else {
                                let playerCenter = this.position.x + this.size.width / 2;
                                let enemyCenter = ePos.x + eSize.width / 2;
                                this._attackDirection = playerCenter <= enemyCenter ? Direction.Right : Direction.Left;

                                enemys[name].onStepped(this, this._attackDirection);
                                this.onPoint(ePos);
                                let effectPos: IPosition = { x: (this.position.x + ePos.x) / 2, y: (this.position.y + ePos.y) / 2 };
                                StarEffect.drawStar(this.targetDom, effectPos, this.pixSize);
                                this._yVector = 12 * this.pixSize;
                            }
                            continue;
                        }
                        return HitStatus.dammage;
                    }
                }
            }
            return HitStatus.none;
        }

        private _specialAnimationIndex = 0;
        private _specialAnimation = [{ index: 0, direction: Direction.Right }, { index: 12, direction: Direction.Right }, { index: 0, direction: Direction.Left }, { index: 13, direction: Direction.Right }]

        private executeJump(): { index: number, direction: Direction } {
            let ground = this.entity.ground || 0;

            if (this.position.y > ground)
                this._isJumping = true;

            if (this._isJumping) {
                this._yVector -= this._gravity * this.pixSize;
                if (this.entity.ceiling != null) {
                    this.position.y = Math.min(this.position.y + this._yVector, this.entity.ceiling - this.size.height + this.size.heightOffset);
                    if (this.position.y == this.entity.ceiling - this.size.height + this.size.heightOffset && this._yVector > 0) {
                        this.upperObject.onPushedUp(this);
                        this._yVector = 0;
                    }
                } else {
                    this.position.y = this.position.y + this._yVector;
                }

                this.moveGrabedEnemy();

                if (this.position.y <= ground) {
                    this._continuousPoint = 0;
                    this._isJumping = false;
                    this._yVector = 0;
                    this.position.y = ground;
                    return null;
                } else {
                    if (!this._grabedEnemy) {
                        if (!this._isSpecial) {
                            if (this._speed > 8) {
                                if (this._yVector > 0 && this.position.y < this.size.height * 3) {
                                    return null;
                                } else {
                                    return { index: 7, direction: this._direction };
                                }
                            } else {
                                return { index: this._yVector > 0 ? 2 : 3, direction: this._direction };
                            }
                        } else {
                            this._specialAnimationIndex++;
                            if (this._specialAnimationIndex > this._specialAnimation.length)
                                this._specialAnimationIndex = 0;
                            return this._specialAnimation[this._specialAnimationIndex];
                        }
                    }
                }
            } else {
                this._yVector = 0;
                return null;
            }
        }

        private moveGrabedEnemy() {
            if (this._grabedEnemy) {
                let grabXOffset = this._direction == Direction.Right ? this.size.width * 0.7 : this.size.width * -1 * 0.7;
                let grabYOffset = this.pixSize;
                this._grabedEnemy.zIndex = this.zIndex - 1;
                this._grabedEnemy.setPosition({ x: this.position.x + grabXOffset, y: this.position.y + grabYOffset });
                this._grabedEnemy.drawAction();
            }
        }

        private executeRun(): { index: number, direction: Direction } {

            this._isBraking = false;
            let direction = this._direction;

            if (((this._isLeft && direction == Direction.Left) || (this._isRight && direction == Direction.Right)) && !this._isSquat) {
                this._speed = AbstractMarioWorld.DEFAULT_SPEED * (this._isLeft ? -1 : 1);
            } else {
                this._speed = 0;
            }

            // Update direction
            if (this._isLeft) {
                this._direction = Direction.Left;
            }
            if (this._isRight) {
                this._direction = Direction.Right;
            }

            if (this._isSpeedUp && (this._isLeft || this._isRight) && !this._isSquat) {
                if (this._isLeft && this._xVector > -10) {
                    this._xVector--;
                }
                if (this._isRight && this._xVector < 10) {
                    this._xVector++;
                }
            } else if (this._xVector != 0) {
                if (this._xVector > 0) {
                    this._xVector--;
                } else {
                    this._xVector++;
                }
            }

            this._speed += this._xVector;

            if ((this._isLeft && this._xVector > 0) || (this._isRight && this._xVector < 0))
                this._isBraking = true;

            if (this._speed > 0) {
                let right = this.entity.right || this.targetDom.clientWidth;
                this.position.x = Math.min(this.position.x + this.pixSize * this._speed, right - this.size.width);
            } else if (this._speed < 0) {
                let left = this.entity.left || 0;
                this.position.x = Math.max(this.position.x + this.pixSize * this._speed, left);
            }

            let runIndex = this._runIndex;

            if (this._currentStep < AbstractMarioWorld.STEP) {
                this._currentStep++;
            } else {
                this._currentStep = 0;
                this._runIndex = this._runIndex ^ 1;
            }

            if (this._speed == 0) this._runIndex = 0;

            // grabed action
            if (this._grabedEnemy) {
                if (this._speed == 0 && (this._isRight || this._isLeft) && this._xVector == 0) {
                    runIndex = 12;
                    this._grabedEnemy.setPosition({ x: this.position.x, y: this.position.y });
                    this._grabedEnemy.zIndex = this.zIndex + 1;
                    this._grabedEnemy.drawAction();
                } else {
                    runIndex = this._runIndex == 0 ? 15 : 16;
                    this.moveGrabedEnemy();
                }
            } else {
                // Speed up action
                if (this._speed > 8 || this._speed < -8) {
                    runIndex = this._runIndex == 0 ? 4 : 5;
                } else {
                    runIndex = this._runIndex;
                }

                // Braking action
                if (!this._isJumping && this._isBraking) {
                    runIndex = 6;
                    direction = direction == Direction.Left ? Direction.Right : Direction.Left;
                    SlipEffect.drawSlip(this.targetDom, { x: this.position.x + (direction == Direction.Left ? this.size.width : 0), y: this.position.y }, this.pixSize);
                }
            }

            if (this._isSquat) {
                if (this._grabedEnemy)
                    runIndex = 14;
                else
                    runIndex = 8;
            }

            if(this._isLookup && !this._grabedEnemy && this._speed == 0) {
                runIndex = 17;
            }

            return { index: runIndex, direction: direction };;
        }

        private _grabedEnemy: IEnemy = null;
        private _grabbing = false;

        private grabEnemy(enemy: IEnemy): void {
            enemy.onGrabed(this);
            this._grabedEnemy = enemy;
        }

        releaseEnemy(): void {
            this._grabedEnemy = null;
        }

        private putEnemy(): void {

        }

        onPushedUp(player: IPlayer) {
            this._yVector += 10; // TODO: check pushed up value
        }

        onStepped(player: IPlayer) {
            this._yVector = 0;
        }

        onGrab(): void {
            if (!this._isJumping && !this._isSquat) {
                this._grabbing = true;
            }
        }

        onAbortGrab(): void {
            this._grabbing = false;
            if (this._grabedEnemy) {
                this.draw(14, null, this._direction, Vertical.Up, true);
                this.stop();
                setTimeout(() => {
                    this.start();
                }, this.frameInterval);
                this._grabedEnemy.onGrabed(null);
                this._grabedEnemy = null;
            }
        }

        onJump(): void {
            if (!this._isJumping && !this._isSquat) {
                this._isJumping = true;
                this._isSpecial = false;
                this._yVector = this._jumpPower * this.pixSize;
            }
        }

        onSpecialJump(): void {
            if (!this._isJumping && !this._isSquat) {
                this._isJumping = true;
                this._isSpecial = true;
                this._yVector = this._jumpPower * this.pixSize;
            }
        }

        onAbortJump(): void {
            if (this._yVector > 0) {
                this._yVector = 0;
            }
        }

        onSpeedUp(): void {
            this._isSpeedUp = true;
        }

        onAbortSpeedUp(): void {
            this._isSpeedUp = false;
        }

        onLookup(): void {
            if (!this._isJumping && !this._isLeft && !this._isRight && !this._isSquat) {
                this._isLookup = true;
            }
        }

        onAbortLookup(): void {
            this._isLookup = false;
        }

        onSquat(): void {
            if (!this._isJumping && !this._isLookup) {
                this._isSquat = true;
            }
        }

        onAbortSquat(): void {
            this._isSquat = false;
        }

        onRight(): void {
            if (!this._isSquat) {
                this._rightPushed = true;
                if (!this._isLeft)
                    this._isRight = true;
            }
        }

        onAbortRight(): void {
            this._rightPushed = false;
            this._isRight = false;
            if (this._leftPushed)
                this._isLeft = true;
        }

        onLeft(): void {
            if (!this._isSquat) {
                this._leftPushed = true;
                if (!this._isRight)
                    this._isLeft = true;
            }
        }

        onAbortLeft(): void {
            this._leftPushed = false;
            this._isLeft = false;
            if (this._rightPushed)
                this._isRight = true;
        }

        onPause(): void {
            if (this._gameMaster) {
                if (this._gameMaster.isStarting()) {
                    this._gameMaster.stop();
                } else {
                    this._gameMaster.start();
                }
            }
        }

        isSquat(): boolean {
            return this._isSquat;
        }

        isJumping(): boolean {
            return this._isJumping;
        }

        public gameOver(): void {
            if (this._gameMaster) this._gameMaster.doGameOver(this);
            if (this._gameController) this._gameController.destroyCommand();
            this.stop();
            this._gameOverTimer = this.getTimer(() => {
                if (this._gameOverWaitCount < 20) {
                    this._gameOverWaitCount++;
                    this.draw(9, null, Direction.Right, Vertical.Up, true);
                    this._yVector = this._jumpPower * this.pixSize;
                    return;
                }

                this._yVector -= this._gravity * this.pixSize;
                this.position.y = this.position.y + this._yVector;

                if (this.position.y < this.size.height * 5 * -1) {
                    this.removeTimer(this._gameOverTimer);
                    this.destroy();
                    return;
                }

                if (this._currentStep < AbstractMarioWorld.STEP) {
                    this._currentStep++;
                } else {
                    this._currentStep = 0;
                    this._runIndex = this._runIndex ^ 1;
                }

                this.draw(9, null, this._runIndex == 0 ? Direction.Left : Direction.Right, Vertical.Up, true);

            }, this.frameInterval);
        }

        public onGool(callback?: Function): void {
            this.draw(10, null, Direction.Right, Vertical.Up, true);
            if (callback) callback();
        }

        registerActionCommand(): void {
        }

        abstract colors: string[];
        cchars = [[[0,16],[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,3,1,1,4,2,11,3,1,4,0,3],[0,4,3,1,7,1,4,4,5,1,0,5],[0,3,3,1,7,2,6,1,13,2,12,2,5,1,0,4],[0,3,3,1,4,3,13,1,2,2,12,1,2,1,5,1,0,3],[0,3,4,1,2,3,4,1,2,2,12,1,2,1,5,1,0,3],[0,3,4,1,2,2,4,1,13,3,12,2,5,1,0,3],[0,3,4,1,2,2,4,1,13,2,5,1,13,1,5,1,0,4],[0,4,4,4,1,1,4,1,1,1,0,5],[0,4,1,1,4,3,8,1,1,1,8,1,1,1,0,4],[0,4,1,8,0,4]],[[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,3,1,1,4,2,11,3,1,4,0,3],[0,3,4,1,7,3,4,3,5,1,0,5],[0,3,4,4,13,2,12,2,5,1,0,4],[0,2,1,1,4,1,2,3,4,1,2,2,12,1,2,1,5,1,1,2,0,1],[0,1,1,1,3,1,4,1,2,2,4,2,2,2,12,1,2,1,1,1,8,1,1,2],[0,1,1,1,3,1,4,1,2,2,4,1,13,3,12,1,5,1,1,1,4,1,1,2],[0,1,1,1,3,1,1,1,4,2,13,4,5,1,1,1,4,1,1,2,0,1],[0,1,1,1,3,1,8,1,1,1,0,1,5,4,0,1,1,1,4,1,1,2,0,1],[0,2,1,2,0,8,1,2,0,2],[0,16],[0,16]],[[0,12,4,2,0,2],[0,11,4,1,2,2,4,1,0,1],[0,10,4,1,2,4,4,1],[0,7,3,5,2,3,4,1],[0,5,3,2,6,3,8,1,6,1,3,1,2,1,4,1,0,1],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,4,2,0,1],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,3,1,0,3],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,1,4,3,7,1,4,1,11,3,1,4,0,3],[4,2,2,2,4,1,7,1,4,4,5,1,0,5],[4,1,2,4,4,1,7,1,13,2,12,2,5,1,0,4],[4,1,2,4,4,1,13,2,2,2,12,1,2,1,5,1,1,2,0,1],[0,1,4,1,2,2,4,1,13,3,2,2,12,1,2,1,1,1,8,1,1,2],[0,1,1,1,3,1,4,1,13,6,12,1,5,1,1,1,4,1,1,2],[0,1,1,1,3,1,5,3,13,4,5,1,1,1,4,1,1,2,0,1],[0,1,1,1,3,1,8,1,1,1,0,1,5,4,0,1,1,1,4,1,1,2,0,1],[0,2,1,2,0,8,1,2,0,2]],[[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,7,1,1,5,11,1,1,2,0,4],[0,1,3,1,7,2,1,2,10,6,0,4],[0,1,3,1,7,1,10,1,1,2,10,2,1,1,10,1,1,1,10,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,10,2,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,1,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,2,1,1,11,2,1,1,10,2,1,1,11,5,4,1,0,1],[0,1,4,1,2,2,3,1,11,2,1,7,2,1,3,1],[4,1,2,4,3,1,11,3,1,4,2,2,3,1],[4,1,2,4,3,1,4,4,5,1,4,1,2,1,1,2,0,1],[0,1,4,1,2,2,3,1,13,4,12,2,5,1,1,1,8,1,1,2],[0,1,1,1,3,2,5,1,13,3,2,2,12,1,2,1,1,1,4,1,1,2],[0,1,1,1,4,2,5,1,13,3,2,2,12,1,2,1,1,1,4,1,1,2],[0,1,1,1,4,1,8,1,5,2,13,4,12,1,5,1,1,1,4,1,1,2],[0,2,1,2,0,1,5,2,13,3,5,1,0,2,1,2,0,1],[0,6,5,4,0,6],[0,16]],[[0,16],[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[4,6,11,3,1,4,0,3],[4,1,2,3,4,1,7,1,4,4,5,1,0,5],[0,1,4,1,2,2,4,1,7,2,13,2,12,2,5,1,0,4],[0,2,4,2,7,2,13,2,2,2,12,1,2,1,5,1,0,3],[0,3,5,1,13,4,2,2,12,1,2,1,5,1,0,3],[0,3,5,1,13,6,12,2,5,1,0,3],[0,3,5,2,13,4,5,1,13,1,5,1,0,4],[0,4,4,4,1,1,4,1,1,1,0,5],[0,4,1,1,4,3,8,1,1,1,8,1,1,1,0,4],[0,4,1,8,0,4]],[[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[4,6,11,3,1,4,0,3],[4,1,2,3,4,1,7,1,4,4,5,1,0,5],[0,1,4,1,2,2,4,1,7,1,13,3,12,2,5,1,0,4],[0,2,4,2,7,2,13,2,2,2,12,1,2,1,5,1,1,2,0,1],[0,1,1,1,3,2,13,4,2,2,12,1,2,1,1,1,8,1,1,2],[0,1,1,1,3,2,13,6,12,1,5,1,1,1,4,1,1,2],[0,1,1,1,3,1,1,1,5,2,13,4,5,1,1,1,4,1,1,2,0,1],[0,1,1,1,3,1,8,1,1,1,0,1,5,4,0,1,1,1,4,1,1,2,0,1],[0,2,1,2,0,8,1,2,0,2],[0,16],[0,16]],[[0,16],[0,5,3,5,0,6],[0,4,3,1,6,1,8,1,6,3,3,2,0,4],[0,4,3,1,2,1,8,2,7,4,3,1,0,3],[0,3,1,6,7,4,3,1,0,2],[0,2,1,9,7,3,3,1,0,1],[0,4,11,5,1,4,7,1,3,1,0,1],[0,4,10,1,1,1,10,1,1,1,10,1,11,1,1,2,10,1,7,2,3,1],[0,2,4,2,10,1,1,1,10,1,1,1,10,2,1,1,10,1,4,1,10,1,7,1,3,1],[0,1,4,1,10,7,1,2,10,1,4,1,11,1,7,1,3,1],[0,1,4,1,11,5,1,1,10,2,1,1,10,1,11,1,1,1,3,1,0,1],[0,2,1,6,4,3,11,1,1,2,7,1,3,1],[0,3,1,4,4,1,2,2,4,2,1,1,2,1,7,1,3,1],[0,4,3,1,7,2,2,4,4,1,2,3,4,1],[0,4,5,1,3,2,2,4,4,1,2,3,4,1],[0,4,5,1,13,1,3,3,2,1,4,3,2,1,4,1,0,1],[0,4,5,1,13,1,4,1,8,1,4,2,13,1,2,2,4,1,0,2],[0,5,1,1,4,2,1,2,13,3,5,1,0,2],[0,5,1,1,4,1,1,3,5,1,13,3,5,1,0,1],[0,6,1,3,0,2,1,1,4,2,1,1,0,1],[0,11,1,1,4,2,8,1,1,1],[0,11,1,5]],[[0,16],[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,3,1,1,4,2,11,3,1,4,0,3],[0,1,1,2,4,9,0,4],[1,1,8,1,4,1,2,3,4,1,7,1,4,1,12,1,5,1,0,5],[0,1,1,1,4,2,2,2,4,1,7,1,4,1,12,2,5,1,0,4],[0,3,5,1,4,3,2,2,12,1,2,1,5,1,0,4],[0,3,1,2,13,3,2,1,12,1,2,1,5,1,0,4],[0,2,1,1,4,2,5,1,13,4,5,1,0,5],[0,2,1,1,4,3,5,1,13,1,5,2,0,6],[0,2,1,1,8,1,1,2,5,3,0,7],[0,3,1,1,0,12]],[[0,16],[0,16],[0,16],[0,16],[0,16],[0,16],[0,16],[0,16],[0,5,3,4,0,7],[0,3,3,2,6,4,3,2,0,5],[0,2,3,1,6,5,7,1,6,2,3,1,0,4],[0,1,3,1,7,2,3,2,6,1,7,1,6,2,8,1,6,1,3,1,0,3],[0,1,3,1,7,1,3,1,2,2,3,1,7,2,9,1,8,1,2,1,3,1,0,3],[0,1,3,2,2,4,3,1,7,1,6,1,1,4,0,2],[0,1,5,1,3,1,2,4,3,1,1,7,0,1],[5,1,13,1,1,1,3,4,7,1,10,6,4,1,0,1],[5,1,13,1,3,1,7,3,3,1,12,1,1,1,11,5,4,1,0,1],[5,1,13,1,3,1,7,2,3,1,13,2,5,1,1,5,0,2],[5,1,13,2,3,2,13,1,5,2,12,1,5,1,1,3,0,3],[5,2,13,2,5,2,4,1,1,1,4,1,1,1,0,6],[0,1,5,3,4,3,8,1,1,1,8,1,1,1,0,5],[0,4,1,7,0,5]],[[0,6,3,4,0,6],[0,4,3,2,6,1,8,2,6,1,3,2,0,4],[0,3,3,1,6,2,2,1,8,2,2,1,6,2,3,1,0,3],[0,2,3,1,6,3,1,4,6,3,3,1,0,2],[0,2,3,1,6,1,1,8,6,1,3,1,0,2],[0,2,3,1,1,10,3,1,0,2],[0,3,3,1,1,1,6,1,1,1,6,2,1,1,6,1,1,1,3,1,0,3],[0,2,1,2,6,8,1,2,0,2],[0,3,1,1,6,8,1,1,0,3],[0,2,1,2,6,1,11,1,1,1,11,2,1,1,11,1,6,1,1,2,0,2],[0,1,4,1,10,1,1,1,11,2,2,4,11,2,1,1,10,1,4,1,0,1],[0,1,4,1,10,1,1,2,10,6,1,2,10,1,4,1,0,1],[0,1,4,1,11,1,1,1,10,1,1,1,11,4,1,1,10,1,1,1,11,1,4,1,0,1],[4,1,2,1,4,1,10,1,1,8,10,1,4,1,0,2],[4,1,2,2,4,1,10,3,3,2,10,3,4,3,0,1],[0,1,4,1,6,2,4,2,10,1,7,2,10,1,4,2,6,1,2,2,4,1],[0,1,4,1,3,1,6,1,5,1,4,1,10,1,6,2,10,1,4,1,1,3,2,1,4,1],[0,3,5,1,12,2,4,1,10,2,4,1,2,1,1,4,0,1],[0,3,5,1,12,1,2,2,4,2,2,2,1,4,0,1],[0,2,1,3,2,2,13,3,5,1,1,4,0,1],[0,1,1,1,8,1,4,2,1,1,5,4,0,1,1,4,0,1],[0,1,1,4,4,1,1,1,0,5,1,2,0,2],[0,4,1,3,0,9]],[[0,16],[0,7,3,4,0,5],[0,5,3,2,6,1,8,2,6,1,3,2,0,3],[1,2,0,1,1,2,6,2,2,1,8,2,2,1,6,2,3,1,0,2],[1,1,2,1,1,1,2,1,1,1,6,2,1,4,6,3,3,1,0,1],[0,1,1,1,2,2,1,9,6,1,3,1,0,1],[1,1,2,1,1,3,11,2,1,1,11,2,1,1,11,2,1,1,3,1,0,1],[1,3,2,1,1,1,10,2,1,1,10,2,1,1,10,2,1,1,4,1,0,1],[1,1,2,1,1,1,2,1,1,2,10,6,1,2,10,1,4,1],[0,1,1,3,3,1,10,1,1,1,11,4,1,1,10,1,4,1,11,1,4,1],[0,1,3,1,7,1,6,1,3,1,11,1,1,6,11,1,4,2,0,1],[0,2,3,1,7,1,6,1,4,1,11,1,1,4,11,1,4,1,7,2,4,1],[0,2,3,1,7,1,6,1,3,1,4,6,7,1,4,3],[0,3,3,1,6,1,5,1,12,5,7,2,2,2,4,1],[0,4,5,1,13,1,12,1,2,2,12,2,2,1,4,1,2,2,4,1],[0,4,5,1,13,2,2,2,12,2,2,1,5,1,4,2,0,1],[0,3,5,1,13,5,12,4,5,1,0,2],[0,3,5,1,13,7,12,2,5,1,0,2],[0,2,5,1,13,10,5,1,0,2],[0,1,1,1,4,3,5,6,4,3,1,1,0,1],[1,1,4,1,8,1,4,1,1,1,0,6,1,1,4,1,8,1,4,1,1,1],[1,4,0,8,1,4]],[[0,16],[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,3,1,1,4,2,11,3,1,4,0,3],[0,2,4,1,6,3,4,4,5,1,0,5],[0,1,4,2,6,2,7,1,13,2,12,3,5,1,0,1,1,2,0,1],[4,1,2,2,4,1,7,1,13,2,2,2,12,1,2,2,5,1,8,1,1,2],[4,1,2,3,4,1,13,2,2,2,12,1,2,2,1,1,4,1,1,2],[4,1,2,2,4,1,5,1,13,4,12,3,1,1,4,1,1,2],[0,1,4,2,0,2,5,1,13,3,5,3,1,1,4,1,1,2],[0,4,1,1,4,3,1,1,0,4,1,2,0,1],[0,4,1,1,4,3,8,1,1,1,0,6],[0,4,1,6,0,6]],[[0,16],[0,16],[0,6,3,4,0,6],[0,4,3,2,6,1,8,2,6,1,3,2,0,4],[0,3,3,1,6,2,8,3,2,1,6,2,3,1,0,3],[0,2,3,1,7,3,1,4,6,3,3,1,0,2],[0,2,3,1,7,1,1,8,6,1,3,1,0,2],[0,2,4,1,1,1,11,2,1,1,11,2,1,1,11,2,1,1,4,1,0,2],[0,1,4,1,10,1,1,1,10,2,1,1,10,2,1,1,10,2,1,1,10,1,4,1,0,1],[0,1,4,1,11,1,1,2,10,6,1,2,11,1,4,1,0,1],[0,2,4,1,1,1,10,1,1,1,11,4,1,1,10,1,1,1,4,1,0,2],[0,3,4,1,11,1,1,6,11,1,4,1,0,3],[0,4,4,1,11,1,1,4,11,1,4,1,0,4],[0,3,3,1,7,1,4,6,6,1,3,1,0,3],[0,2,3,1,7,2,13,1,12,5,7,1,6,1,3,1,0,2],[0,2,4,1,7,1,13,1,2,2,12,2,2,2,12,1,7,1,4,1,0,2],[0,1,4,1,2,1,4,1,13,1,2,2,12,2,2,2,12,1,4,1,2,1,4,1,0,1],[0,1,4,1,2,1,4,1,13,4,12,4,4,1,2,1,4,1,0,1],[0,2,4,2,5,1,13,2,5,2,13,2,5,1,4,2,0,2],[0,4,1,1,4,6,1,1,0,4],[0,3,1,1,4,1,8,1,4,1,1,2,4,1,8,1,4,1,1,1,0,3],[0,3,1,10,0,3]],[[0,16],[0,16],[0,6,3,4,0,6],[0,4,3,2,6,4,3,2,0,4],[0,3,3,1,6,8,3,1,0,3],[0,2,3,1,6,10,3,1,0,2],[0,2,3,1,7,1,6,9,3,1,0,2],[0,2,4,1,7,1,6,8,7,1,4,1,0,2],[0,2,4,1,3,1,7,2,6,4,7,2,3,1,4,1,0,2],[0,1,4,1,10,1,1,1,3,2,7,4,3,2,1,1,10,1,4,1,0,1],[0,1,4,1,11,1,1,3,3,4,1,3,11,1,4,1,0,1],[0,2,4,2,1,8,4,2,0,2],[0,4,11,1,1,6,11,1,0,4],[0,3,3,2,12,2,1,2,12,2,3,2,0,3],[0,2,3,1,7,1,5,1,12,2,8,2,12,2,5,1,7,1,3,1,0,2],[0,2,3,1,5,1,12,8,5,1,3,1,0,2],[0,2,3,1,5,3,12,4,5,3,3,1,0,2],[0,3,5,1,12,2,5,1,12,2,5,1,13,2,5,1,0,3],[0,4,5,1,13,1,5,4,13,1,5,1,0,4],[0,4,1,1,4,6,1,1,0,4],[0,3,1,1,4,3,1,2,4,3,1,1,0,3],[0,3,1,10,0,3]],[[0,16],[0,16],[0,16],[0,16],[0,16],[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,8,2,2,1,3,1,0,3],[0,3,3,1,6,2,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,0,4],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,2,1,1,10,2,1,1,11,5,4,1,0,1],[5,1,13,4,11,2,1,7,0,2],[5,1,13,5,3,1,6,3,4,4,0,2],[5,1,13,3,5,2,3,1,7,2,6,2,3,1,2,1,4,3],[5,1,13,6,3,2,7,2,3,1,2,3,4,1],[0,1,5,1,13,2,1,1,4,3,1,1,3,3,2,3,4,1],[0,2,5,2,1,1,4,3,8,1,1,1,8,1,1,1,4,3,0,1],[0,4,1,8,0,4]],[[0,16],[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,3,1,1,4,2,11,3,1,2,4,3,0,2],[0,4,5,1,13,1,4,5,3,1,2,1,4,3],[0,3,5,1,13,2,3,1,6,4,3,1,2,3,4,1],[0,3,5,1,13,2,3,1,7,4,3,1,2,3,4,1],[0,3,5,1,13,3,3,5,4,3,0,1],[0,3,5,1,13,6,12,2,5,1,0,3],[0,3,5,1,13,5,5,1,13,1,5,1,0,4],[0,4,5,1,4,3,1,1,4,1,1,1,0,5],[0,4,1,1,4,3,8,1,1,1,8,1,1,1,0,4],[0,4,1,8,0,4]],[[0,16],[0,7,3,5,0,4],[0,5,3,2,6,3,8,1,6,1,3,1,0,3],[0,4,3,1,6,2,7,2,9,1,8,1,2,1,3,1,0,3],[0,3,3,1,7,1,6,1,7,2,1,6,0,2],[0,2,3,1,7,3,1,9,0,1],[0,2,3,1,10,1,1,3,11,1,1,1,11,1,1,1,11,1,0,4],[0,1,3,1,10,1,4,1,10,1,1,1,11,1,10,1,1,1,10,1,1,1,10,1,4,2,0,2],[0,1,3,1,11,1,4,1,10,1,1,2,10,7,4,1,0,1],[0,1,3,1,1,1,11,1,10,1,1,1,10,2,1,1,11,5,4,1,0,1],[0,2,1,2,11,2,10,1,1,7,0,2],[0,3,1,1,4,1,11,4,1,2,4,3,0,2],[0,4,5,1,4,6,3,1,2,1,4,3],[0,3,5,2,13,1,3,1,6,4,3,1,2,3,4,1],[0,2,1,1,5,1,13,2,3,1,7,4,3,1,2,3,4,1],[0,1,1,1,4,1,5,1,13,3,3,5,4,3,1,1],[0,1,1,1,4,1,5,1,13,6,12,1,5,1,1,1,4,1,1,2],[0,1,1,1,4,1,1,1,5,2,13,4,5,1,1,1,4,1,1,2,0,1],[0,1,1,1,4,1,8,1,1,1,0,1,5,4,0,1,1,1,4,1,1,2,0,1],[0,2,1,2,0,8,1,2,0,2],[0,16],[0,16]],[[0,16],[0,9,4,2,0,5],[0,4,1,3,0,1,4,1,10,2,4,1,0,4],[0,2,3,2,1,3,4,1,10,2,11,2,4,1,0,3],[0,1,3,1,6,1,1,4,4,1,10,1,11,3,4,1,0,3],[0,1,3,1,6,1,1,3,11,1,4,1,10,1,11,1,1,4,0,2],[3,1,7,1,6,1,1,1,11,1,1,2,11,1,1,7,0,1],[3,1,7,1,6,1,1,1,11,2,10,1,1,3,10,3,1,2,0,1],[3,1,7,1,6,1,1,1,11,1,1,1,10,2,1,1,10,4,1,1,0,2],[3,1,7,1,6,1,1,4,10,6,4,1,0,2],[0,1,3,1,7,1,10,2,11,1,10,3,11,3,4,1,0,3],[0,1,3,1,11,1,4,2,10,1,11,6,4,1,0,3],[0,2,3,1,11,1,10,1,1,1,11,4,4,2,0,4],[0,3,3,2,7,1,13,2,3,2,5,1,0,5],[0,3,3,1,7,2,6,1,13,2,12,2,5,1,0,4],[0,3,3,1,4,3,13,1,2,2,12,1,2,1,5,1,0,3],[0,3,4,1,2,3,4,1,2,2,12,1,2,1,5,1,0,3],[0,3,4,1,2,2,4,1,13,3,12,2,5,1,0,3],[0,3,4,1,2,2,4,1,13,2,5,1,13,1,5,1,0,4],[0,4,4,4,1,1,4,1,1,1,0,5],[0,4,1,1,4,3,8,1,1,1,8,1,1,1,0,4],[0,4,1,8,0,4]]];
        chars = null;
        // cchars = null;
        /*
        chars = [[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 4, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 7, 4, 4, 4, 4, 5, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 7, 6,13,13,12,12, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 4, 4, 4,13, 2, 2,12, 2, 5, 0, 0, 0],
                [ 0, 0, 0, 4, 2, 2, 2, 4, 2, 2,12, 2, 5, 0, 0, 0],
                [ 0, 0, 0, 4, 2, 2, 4,13,13,13,12,12, 5, 0, 0, 0],
                [ 0, 0, 0, 4, 2, 2, 4,13,13, 5,13, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 4, 4, 4, 4, 1, 4, 1, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 8, 1, 8, 1, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 4, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 0, 0, 0, 4, 7, 7, 7, 4, 4, 4, 5, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 4, 4, 4, 4,13,13,12,12, 5, 0, 0, 0, 0],
                [ 0, 0, 1, 4, 2, 2, 2, 4, 2, 2,12, 2, 5, 1, 1, 0],
                [ 0, 1, 3, 4, 2, 2, 4, 4, 2, 2,12, 2, 1, 8, 1, 1],
                [ 0, 1, 3, 4, 2, 2, 4,13,13,13,12, 5, 1, 4, 1, 1],
                [ 0, 1, 3, 1, 4, 4,13,13,13,13, 5, 1, 4, 1, 1, 0],
                [ 0, 1, 3, 8, 1, 0, 5, 5, 5, 5, 0, 1, 4, 1, 1, 0],
                [ 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 2, 2, 4, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 2, 2, 2, 2, 4],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 2, 2, 2, 4],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 2, 4, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 4, 4, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 3, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 4, 4, 4, 7, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 4, 4, 2, 2, 4, 7, 4, 4, 4, 4, 5, 0, 0, 0, 0, 0],
                [ 4, 2, 2, 2, 2, 4, 7,13,13,12,12, 5, 0, 0, 0, 0],
                [ 4, 2, 2, 2, 2, 4,13,13, 2, 2,12, 2, 5, 1, 1, 0],
                [ 0, 4, 2, 2, 4,13,13,13, 2, 2,12, 2, 1, 8, 1, 1],
                [ 0, 1, 3, 4,13,13,13,13,13,13,12, 5, 1, 4, 1, 1],
                [ 0, 1, 3, 5, 5, 5,13,13,13,13, 5, 1, 4, 1, 1, 0],
                [ 0, 1, 3, 8, 1, 0, 5, 5, 5, 5, 0, 1, 4, 1, 1, 0],
                [ 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3, 7, 1, 1, 1, 1, 1,11, 1, 1, 0, 0, 0, 0],
                [ 0, 3, 7, 7, 1, 1,10,10,10,10,10,10, 0, 0, 0, 0],
                [ 0, 3, 7,10, 1, 1,10,10, 1,10, 1,10, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,10,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 1,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 0, 1,11,11, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 4, 2, 2, 3,11,11, 1, 1, 1, 1, 1, 1, 1, 2, 3],
                [ 4, 2, 2, 2, 2, 3,11,11,11, 1, 1, 1, 1, 2, 2, 3],
                [ 4, 2, 2, 2, 2, 3, 4, 4, 4, 4, 5, 4, 2, 1, 1, 0],
                [ 0, 4, 2, 2, 3,13,13,13,13,12,12, 5, 1, 8, 1, 1],
                [ 0, 1, 3, 3, 5,13,13,13, 2, 2,12, 2, 1, 4, 1, 1],
                [ 0, 1, 4, 4, 5,13,13,13, 2, 2,12, 2, 1, 4, 1, 1],
                [ 0, 1, 4, 8, 5, 5,13,13,13,13,12, 5, 1, 4, 1, 1],
                [ 0, 0, 1, 1, 0, 5, 5,13,13,13, 5, 0, 0, 1, 1, 0],
                [ 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 4, 4, 4, 4, 4, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 4, 2, 2, 2, 4, 7, 4, 4, 4, 4, 5, 0, 0, 0, 0, 0],
                [ 0, 4, 2, 2, 4, 7, 7,13,13,12,12, 5, 0, 0, 0, 0],
                [ 0, 0, 4, 4, 7, 7,13,13, 2, 2,12, 2, 5, 0, 0, 0],
                [ 0, 0, 0, 5,13,13,13,13, 2, 2,12, 2, 5, 0, 0, 0],
                [ 0, 0, 0, 5,13,13,13,13,13,13,12,12, 5, 0, 0, 0],
                [ 0, 0, 0, 5, 5,13,13,13,13, 5,13, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 4, 4, 4, 4, 1, 4, 1, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 8, 1, 8, 1, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 4, 4, 4, 4, 4, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 4, 2, 2, 2, 4, 7, 4, 4, 4, 4, 5, 0, 0, 0, 0, 0],
                [ 0, 4, 2, 2, 4, 7,13,13,13,12,12, 5, 0, 0, 0, 0],
                [ 0, 0, 4, 4, 7, 7,13,13, 2, 2,12, 2, 5, 1, 1, 0],
                [ 0, 1, 3, 3,13,13,13,13, 2, 2,12, 2, 1, 8, 1, 1],
                [ 0, 1, 3, 3,13,13,13,13,13,13,12, 5, 1, 4, 1, 1],
                [ 0, 1, 3, 1, 5, 5,13,13,13,13, 5, 1, 4, 1, 1, 0],
                [ 0, 1, 3, 8, 1, 0, 5, 5, 5, 5, 0, 1, 4, 1, 1, 0],
                [ 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 8, 6, 6, 6, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 2, 8, 8, 7, 7, 7, 7, 3, 0, 0, 0],
                [ 0, 0, 0, 1, 1, 1, 1, 1, 1, 7, 7, 7, 7, 3, 0, 0],
                [ 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 7, 7, 7, 3, 0],
                [ 0, 0, 0, 0,11,11,11,11,11, 1, 1, 1, 1, 7, 3, 0],
                [ 0, 0, 0, 0,10, 1,10, 1,10,11, 1, 1,10, 7, 7, 3],
                [ 0, 0, 4, 4,10, 1,10, 1,10,10, 1,10, 4,10, 7, 3],
                [ 0, 4,10,10,10,10,10,10,10, 1, 1,10, 4,11, 7, 3],
                [ 0, 4,11,11,11,11,11, 1,10,10, 1,10,11, 1, 3, 0],
                [ 0, 0, 1, 1, 1, 1, 1, 1, 4, 4, 4,11, 1, 1, 7, 3],
                [ 0, 0, 0, 1, 1, 1, 1, 4, 2, 2, 4, 4, 1, 2, 7, 3],
                [ 0, 0, 0, 0, 3, 7, 7, 2, 2, 2, 2, 4, 2, 2, 2, 4],
                [ 0, 0, 0, 0, 5, 3, 3, 2, 2, 2, 2, 4, 2, 2, 2, 4],
                [ 0, 0, 0, 0, 5,13, 3, 3, 3, 2, 4, 4, 4, 2, 4, 0],
                [ 0, 0, 0, 0, 5,13, 4, 8, 4, 4,13, 2, 2, 4, 0, 0],
                [ 0, 0, 0, 0, 0, 1, 4, 4, 1, 1,13,13,13, 5, 0, 0],
                [ 0, 0, 0, 0, 0, 1, 4, 1, 1, 1, 5,13,13,13, 5, 0],
                [ 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 4, 4, 1, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 8, 1],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 4, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 0, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0],
                [ 1, 8, 4, 2, 2, 2, 4, 7, 4,12, 5, 0, 0, 0, 0, 0],
                [ 0, 1, 4, 4, 2, 2, 4, 7, 4,12,12, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 5, 4, 4, 4, 2, 2,12, 2, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 1, 1,13,13,13, 2,12, 2, 5, 0, 0, 0, 0],
                [ 0, 0, 1, 4, 4, 5,13,13,13,13, 5, 0, 0, 0, 0, 0],
                [ 0, 0, 1, 4, 4, 4, 5,13, 5, 5, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 1, 8, 1, 1, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 3, 6, 6, 6, 6, 3, 3, 0, 0, 0, 0, 0],
                [ 0, 0, 3, 6, 6, 6, 6, 6, 7, 6, 6, 3, 0, 0, 0, 0],
                [ 0, 3, 7, 7, 3, 3, 6, 7, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 3, 7, 3, 2, 2, 3, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 3, 3, 2, 2, 2, 2, 3, 7, 6, 1, 1, 1, 1, 0, 0],
                [ 0, 5, 3, 2, 2, 2, 2, 3, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 5,13, 1, 3, 3, 3, 3, 7,10,10,10,10,10,10, 4, 0],
                [ 5,13, 3, 7, 7, 7, 3,12, 1,11,11,11,11,11, 4, 0],
                [ 5,13, 3, 7, 7, 3,13,13, 5, 1, 1, 1, 1, 1, 0, 0],
                [ 5,13,13, 3, 3,13, 5, 5,12, 5, 1, 1, 1, 0, 0, 0],
                [ 5, 5,13,13, 5, 5, 4, 1, 4, 1, 0, 0, 0, 0, 0, 0],
                [ 0, 5, 5, 5, 4, 4, 4, 8, 1, 8, 1, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]            
            ], [
                [ 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 3, 6, 8, 8, 6, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 6, 6, 2, 8, 8, 2, 6, 6, 3, 0, 0, 0],
                [ 0, 0, 3, 6, 6, 6, 1, 1, 1, 1, 6, 6, 6, 3, 0, 0],
                [ 0, 0, 3, 6, 1, 1, 1, 1, 1, 1, 1, 1, 6, 3, 0, 0],
                [ 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0],
                [ 0, 0, 0, 3, 1, 6, 1, 6, 6, 1, 6, 1, 3, 0, 0, 0],
                [ 0, 0, 1, 1, 6, 6, 6, 6, 6, 6, 6, 6, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 6, 6, 6, 6, 6, 6, 6, 6, 1, 0, 0, 0],
                [ 0, 0, 1, 1, 6,11, 1,11,11, 1,11, 6, 1, 1, 0, 0],
                [ 0, 4,10, 1,11,11, 2, 2, 2, 2,11,11, 1,10, 4, 0],
                [ 0, 4,10, 1, 1,10,10,10,10,10,10, 1, 1,10, 4, 0],
                [ 0, 4,11, 1,10, 1,11,11,11,11, 1,10, 1,11, 4, 0],
                [ 4, 2, 4,10, 1, 1, 1, 1, 1, 1, 1, 1,10, 4, 0, 0],
                [ 4, 2, 2, 4,10,10,10, 3, 3,10,10,10, 4, 4, 4, 0],
                [ 0, 4, 6, 6, 4, 4,10, 7, 7,10, 4, 4, 6, 2, 2, 4],
                [ 0, 4, 3, 6, 5, 4,10, 6, 6,10, 4, 1, 1, 1, 2, 4],
                [ 0, 0, 0, 5,12,12, 4,10,10, 4, 2, 1, 1, 1, 1, 0],
                [ 0, 0, 0, 5,12, 2, 2, 4, 4, 2, 2, 1, 1, 1, 1, 0],
                [ 0, 0, 1, 1, 1, 2, 2,13,13,13, 5, 1, 1, 1, 1, 0],
                [ 0, 1, 8, 4, 4, 1, 5, 5, 5, 5, 0, 1, 1, 1, 1, 0],
                [ 0, 1, 1, 1, 1, 4, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]            
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 8, 8, 6, 3, 3, 0, 0, 0],
                [ 1, 1, 0, 1, 1, 6, 6, 2, 8, 8, 2, 6, 6, 3, 0, 0],
                [ 1, 2, 1, 2, 1, 6, 6, 1, 1, 1, 1, 6, 6, 6, 3, 0],
                [ 0, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 3, 0],
                [ 1, 2, 1, 1, 1,11,11, 1,11,11, 1,11,11, 1, 3, 0],
                [ 1, 1, 1, 2, 1,10,10, 1,10,10, 1,10,10, 1, 4, 0],
                [ 1, 2, 1, 2, 1, 1,10,10,10,10,10,10, 1, 1,10, 4],
                [ 0, 1, 1, 1, 3,10, 1,11,11,11,11, 1,10, 4,11, 4],
                [ 0, 3, 7, 6, 3,11, 1, 1, 1, 1, 1, 1,11, 4, 4, 0],
                [ 0, 0, 3, 7, 6, 4,11, 1, 1, 1, 1,11, 4, 7, 7, 4],
                [ 0, 0, 3, 7, 6, 3, 4, 4, 4, 4, 4, 4, 7, 4, 4, 4],
                [ 0, 0, 0, 3, 6, 5,12,12,12,12,12, 7, 7, 2, 2, 4],
                [ 0, 0, 0, 0, 5,13,12, 2, 2,12,12, 2, 4, 2, 2, 4],
                [ 0, 0, 0, 0, 5,13,13, 2, 2,12,12, 2, 5, 4, 4, 0],
                [ 0, 0, 0, 5,13,13,13,13,13,12,12,12,12, 5, 0, 0],
                [ 0, 0, 0, 5,13,13,13,13,13,13,13,12,12, 5, 0, 0],
                [ 0, 0, 5,13,13,13,13,13,13,13,13,13,13, 5, 0, 0],
                [ 0, 1, 4, 4, 4, 5, 5, 5, 5, 5, 5, 4, 4, 4, 1, 0],
                [ 1, 4, 8, 4, 1, 0, 0, 0, 0, 0, 0, 1, 4, 8, 4, 1],
                [ 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
            ], [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 4, 4,11,11,11, 1, 1, 1, 1, 0, 0, 0],
                [ 0, 0, 4, 6, 6, 6, 4, 4, 4, 4, 5, 0, 0, 0, 0, 0],
                [ 0, 4, 4, 6, 6, 7,13,13,12,12,12, 5, 0, 1, 1, 0],
                [ 4, 2, 2, 4, 7,13,13, 2, 2,12, 2, 2, 5, 8, 1, 1],
                [ 4, 2, 2, 2, 4,13,13, 2, 2,12, 2, 2, 1, 4, 1, 1],
                [ 4, 2, 2, 4, 5,13,13,13,13,12,12,12, 1, 4, 1, 1],
                [ 0, 4, 4, 0, 0, 5,13,13,13, 5, 5, 5, 1, 4, 1, 1],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 1, 0, 0, 0, 0, 1, 1, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 8, 1, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 3, 6, 8, 8, 6, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 6, 6, 8, 8, 8, 2, 6, 6, 3, 0, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 6, 6, 6, 3, 0, 0],
                [ 0, 0, 3, 7, 1, 1, 1, 1, 1, 1, 1, 1, 6, 3, 0, 0],
                [ 0, 0, 4, 1,11,11, 1,11,11, 1,11,11, 1, 4, 0, 0],
                [ 0, 4,10, 1,10,10, 1,10,10, 1,10,10, 1,10, 4, 0],
                [ 0, 4,11, 1, 1,10,10,10,10,10,10, 1, 1,11, 4, 0],
                [ 0, 0, 4, 1,10, 1,11,11,11,11, 1,10, 1, 4, 0, 0],
                [ 0, 0, 0, 4,11, 1, 1, 1, 1, 1, 1,11, 4, 0, 0, 0],
                [ 0, 0, 0, 0, 4,11, 1, 1, 1, 1,11, 4, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 4, 4, 4, 4, 4, 4, 6, 3, 0, 0, 0],
                [ 0, 0, 3, 7, 7,13,12,12,12,12,12, 7, 6, 3, 0, 0],
                [ 0, 0, 4, 7,13, 2, 2,12,12, 2, 2,12, 7, 4, 0, 0],
                [ 0, 4, 2, 4,13, 2, 2,12,12, 2, 2,12, 4, 2, 4, 0],
                [ 0, 4, 2, 4,13,13,13,13,12,12,12,12, 4, 2, 4, 0],
                [ 0, 0, 4, 4, 5,13,13, 5, 5,13,13, 5, 4, 4, 0, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0],
                [ 0, 0, 0, 1, 4, 8, 4, 1, 1, 4, 8, 4, 1, 0, 0, 0],
                [ 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]            
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 3, 6, 6, 6, 6, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 6, 6, 6, 6, 6, 6, 6, 6, 3, 0, 0, 0],
                [ 0, 0, 3, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 3, 0, 0],
                [ 0, 0, 3, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 3, 0, 0],
                [ 0, 0, 4, 7, 6, 6, 6, 6, 6, 6, 6, 6, 7, 4, 0, 0],
                [ 0, 0, 4, 3, 7, 7, 6, 6, 6, 6, 7, 7, 3, 4, 0, 0],
                [ 0, 4,10, 1, 3, 3, 7, 7, 7, 7, 3, 3, 1,10, 4, 0],
                [ 0, 4,11, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1,11, 4, 0],
                [ 0, 0, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 0, 0],
                [ 0, 0, 0, 0,11, 1, 1, 1, 1, 1, 1,11, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 3,12,12, 1, 1,12,12, 3, 3, 0, 0, 0],
                [ 0, 0, 3, 7, 5,12,12, 8, 8,12,12, 5, 7, 3, 0, 0],
                [ 0, 0, 3, 5,12,12,12,12,12,12,12,12, 5, 3, 0, 0],
                [ 0, 0, 3, 5, 5, 5,12,12,12,12, 5, 5, 5, 3, 0, 0],
                [ 0, 0, 0, 5,12,12, 5,12,12, 5,13,13, 5, 0, 0, 0],
                [ 0, 0, 0, 0, 5,13, 5, 5, 5, 5,13, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0],
                [ 0, 0, 0, 1, 4, 4, 4, 1, 1, 4, 4, 4, 1, 0, 0, 0],
                [ 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]            
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 8, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 6, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 0, 0, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,11, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 5,13,13,13,13,11,11, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 5,13,13,13,13,13, 3, 6, 6, 6, 4, 4, 4, 4, 0, 0],
                [ 5,13,13,13, 5, 5, 3, 7, 7, 6, 6, 3, 2, 4, 4, 4],
                [ 5,13,13,13,13,13,13, 3, 3, 7, 7, 3, 2, 2, 2, 4],
                [ 0, 5,13,13, 1, 4, 4, 4, 1, 3, 3, 3, 2, 2, 2, 4],
                [ 0, 0, 5, 5, 1, 4, 4, 4, 8, 1, 8, 1, 4, 4, 4, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]            
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 4, 4,11,11,11, 1, 1, 4, 4, 4, 0, 0],
                [ 0, 0, 0, 0, 5,13, 4, 4, 4, 4, 4, 3, 2, 4, 4, 4],
                [ 0, 0, 0, 5,13,13, 3, 6, 6, 6, 6, 3, 2, 2, 2, 4],
                [ 0, 0, 0, 5,13,13, 3, 7, 7, 7, 7, 3, 2, 2, 2, 4],
                [ 0, 0, 0, 5,13,13,13, 3, 3, 3, 3, 3, 4, 4, 4, 0],
                [ 0, 0, 0, 5,13,13,13,13,13,13,12,12, 5, 0, 0, 0],
                [ 0, 0, 0, 5,13,13,13,13,13, 5,13, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 5, 4, 4, 4, 1, 4, 1, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 8, 1, 8, 1, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 3, 3, 6, 6, 6, 8, 6, 3, 0, 0, 0],
                [ 0, 0, 0, 0, 3, 6, 6, 7, 7, 9, 8, 2, 3, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 6, 7, 7, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 3, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 0, 0, 3,10, 1, 1, 1,11, 1,11, 1,11, 0, 0, 0, 0],
                [ 0, 3,10, 4,10, 1,11,10, 1,10, 1,10, 4, 4, 0, 0],
                [ 0, 3,11, 4,10, 1, 1,10,10,10,10,10,10,10, 4, 0],
                [ 0, 3, 1,11,10, 1,10,10, 1,11,11,11,11,11, 4, 0],
                [ 0, 0, 1, 1,11,11,10, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [ 0, 0, 0, 1, 4,11,11,11,11, 1, 1, 4, 4, 4, 0, 0],
                [ 0, 0, 0, 0, 5, 4, 4, 4, 4, 4, 4, 3, 2, 4, 4, 4],
                [ 0, 0, 0, 5, 5,13, 3, 6, 6, 6, 6, 3, 2, 2, 2, 4],
                [ 0, 0, 1, 5,13,13, 3, 7, 7, 7, 7, 3, 2, 2, 2, 4],
                [ 0, 1, 4, 5,13,13,13, 3, 3, 3, 3, 3, 4, 4, 4, 1],
                [ 0, 1, 4, 5,13,13,13,13,13,13,12, 5, 1, 4, 1, 1],
                [ 0, 1, 4, 1, 5, 5,13,13,13,13, 5, 1, 4, 1, 1, 0],
                [ 0, 1, 4, 8, 1, 0, 5, 5, 5, 5, 0, 1, 4, 1, 1, 0],
                [ 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ],[
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 0, 4,10,10, 4, 0, 0, 0, 0],
                [ 0, 0, 3, 3, 1, 1, 1, 4,10,10,11,11, 4, 0, 0, 0],
                [ 0, 3, 6, 1, 1, 1, 1, 4,10,11,11,11, 4, 0, 0, 0],
                [ 0, 3, 6, 1, 1, 1,11, 4,10,11, 1, 1, 1, 1, 0, 0],
                [ 3, 7, 6, 1,11, 1, 1,11, 1, 1, 1, 1, 1, 1, 1, 0],
                [ 3, 7, 6, 1,11,11,10, 1, 1, 1,10,10,10, 1, 1, 0],
                [ 3, 7, 6, 1,11, 1,10,10, 1,10,10,10,10, 1, 0, 0],
                [ 3, 7, 6, 1, 1, 1, 1,10,10,10,10,10,10, 4, 0, 0],
                [ 0, 3, 7,10,10,11,10,10,10,11,11,11, 4, 0, 0, 0],
                [ 0, 3,11, 4, 4,10,11,11,11,11,11,11, 4, 0, 0, 0],
                [ 0, 0, 3,11,10, 1,11,11,11,11, 4, 4, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 3, 7,13,13, 3, 3, 5, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 7, 7, 6,13,13,12,12, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 3, 4, 4, 4,13, 2, 2,12, 2, 5, 0, 0, 0],
                [ 0, 0, 0, 4, 2, 2, 2, 4, 2, 2,12, 2, 5, 0, 0, 0],
                [ 0, 0, 0, 4, 2, 2, 4,13,13,13,12,12, 5, 0, 0, 0],
                [ 0, 0, 0, 4, 2, 2, 4,13,13, 5,13, 5, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 4, 4, 4, 4, 1, 4, 1, 0, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 4, 4, 4, 8, 1, 8, 1, 0, 0, 0, 0],
                [ 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
            ]];
        */
    }
}

