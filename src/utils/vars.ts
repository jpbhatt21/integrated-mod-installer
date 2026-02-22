import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
export const store = createStore();
import defConfig from "../default.json";
import { VERSION } from "./consts";
import { Category, DownloadList, Games, Language } from "./types";
import GAME_DATA from "@/gameData.json";
interface UpdateInfo {
	version: string;
	status: "available" | "downloading" | "ready" | "error" | "installed" | "ignored";
	date: string;
	body: string;
	raw: any | null;
}
const CATEGORIES = atom({
	WW: [...GAME_DATA.WW.categoryList, ...GAME_DATA.WW.generic.categories],
	ZZ: [...GAME_DATA.ZZ.categoryList, ...GAME_DATA.ZZ.generic.categories],
	GI: [...GAME_DATA.GI.categoryList, ...GAME_DATA.GI.generic.categories],
	SR: [...GAME_DATA.SR.categoryList, ...GAME_DATA.SR.generic.categories],
	EF: [...GAME_DATA.EF.categoryList, ...GAME_DATA.EF.generic.categories],
	"": [],
} as {
	[key in Games]: Category[];
});
const FIRST_LOAD = atom(false);
const SAVED_LANG = atomWithStorage<Language | "">("imm-lang", "");
const DOWNLOAD_LIST = atom<DownloadList>({
	queue: [],
	downloading: [],
	completed: [],
	extracting: [],
	failed: [],
});
const TOASTS = atom([] as any[]);
const IMM_UPDATE = atom(null as UpdateInfo | null);
const UPDATER_OPEN = atom(false);
const NOTICE = atom({
	heading: "",
	subheading: "",
	ignoreable: 2,
	timer: 10,
	ver: VERSION,
	id: 0,
} as any);
const NOTICE_OPEN = atom(false);
const FILE_TO_DL = atom("");
const ERR = atom("");
const CONFIG = atom(defConfig);
export {
	CONFIG,
	CATEGORIES,
	FILE_TO_DL,
	ERR,
	FIRST_LOAD,
	NOTICE,
	NOTICE_OPEN,
	UPDATER_OPEN,
	IMM_UPDATE,
	TOASTS,
	DOWNLOAD_LIST,
	SAVED_LANG,
};
