import { Games } from "./types";
import GAME_DATA from "@/gameData.json";
export const DISCORD_LINK = "https://discord.gg/QGkKzNapXZ";
export const BANANA_LINK = "https://gamebanana.com/mods/593490";
export const UNCATEGORIZED = "Uncategorized";
export const IMAGE_SERVER = "http://127.0.0.1:4469/preview";
export const managedSRC = "DISABLED - ALL MODS ARE STORED HERE (Managed by IMM)";
export const managedTGT = "DO NOT MODIFY (Managed by IMM)";
export const VERSION = "1.0.0";
export const GAMES: Games[] = ["WW", "ZZ", "GI", "SR", "EF"];
export const GAME_GB_IDS: { [key: number]: Games } = {
	20357: "WW",
	19567: "ZZ",
	8552: "GI",
	18366: "SR",
	21842: "EF",
	0: "",
};
export const GAME_NAMES: { [key in Games]: string } = {
	WW: "WuWa",
	ZZ: "Z·Z·Z",
	"": "Integrated",
	GI: "Genshin",
	SR: "Star Rail",
	EF: "Endfield",
};
export const GAME_ICONS: { [key in Games]: string } = {
	WW: "https://images.gamebanana.com/img/ico/games/686bf76048ba2.png",
	ZZ: "https://images.gamebanana.com/img/ico/games/657d72ea51567.png",
	"": "icon.png",
	GI: "https://images.gamebanana.com/img/ico/games/686d7fdcbeb5a.png",
	SR: "https://images.gamebanana.com/img/ico/games/686d7fe451b81.png",
	EF: "https://images.gamebanana.com/img/ico/games/69725f15986b1.png",
};
export const exts = ["png", "jpg", "jpeg", "webp", "gif"];
export const PRIORITY_KEYS = ["Alt", "Ctrl", "Shift", "Capslock", "Tab", "Up", "Down", "Left", "Right"] as const;
export const TYPES = {
	"WW": GAME_DATA.WW.generic.types,
	"ZZ": GAME_DATA.ZZ.generic.types,
	"GI": GAME_DATA.GI.generic.types,
	"SR": GAME_DATA.SR.generic.types,
	"EF": GAME_DATA.EF.generic.types,
	"": [],
}
export const GAME_ID_MAP: { [key: string]: number } = {
	WW: 0,
	ZZ: 1,
	GI: 2,
	SR: 3,
	EF: 4,
};
