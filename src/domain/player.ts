export type PlayerId = string;

/** lobby: 아직 한 라운드도 뛰지 않음, alive: 생존, out: 탈락 */
export type PlayerStatus = "lobby" | "alive" | "out";

export type Player = {
	readonly id: PlayerId;
	readonly name: string;
	/** 누군가 폰으로 이 이름을 골라 입장했는지 */
	readonly claimed: boolean;
	readonly status: PlayerStatus;
};

export type Scores = Readonly<Record<PlayerId, number>>;
