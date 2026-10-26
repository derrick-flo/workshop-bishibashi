export type PlayerId = string;

export type Player = {
	readonly id: PlayerId;
	readonly name: string;
	/** 누군가 폰으로 이 이름을 골라 입장했는지 */
	readonly claimed: boolean;
};

export type Scores = Readonly<Record<PlayerId, number>>;
