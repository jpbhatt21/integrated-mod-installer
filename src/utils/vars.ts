import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
export const store = createStore();
import defConfig from "../default.json";
import { VERSION } from "./consts";
import { Category, DownloadList, Games, Language, OnlineData } from "./types";
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
const SAVED_LANG = atomWithStorage<Language>("imm-lang", "en");
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
const BROWSE_SETTINGS = atomWithStorage("imi-browse-settings", {
	game: "WW",
	nsfw: 1,
});
const BROWSE_TYPE = atom("Mod");
const BROWSE_PATH = atom("home&_type=Mod");
const BROWSE_SORT = atom("");
const BROWSE_SELECTED = atom("");
const BROWSE_DATA = atom({
	WW: {} as OnlineData,
	ZZ: {} as OnlineData,
	GI: {} as OnlineData,
	SR: {} as OnlineData,
	EF: {} as OnlineData,
	"": {} as OnlineData,
});
const BROWSE_RIGHT_SLIDE_OVER_OPEN = atom(false);
const INIT_DONE = atom(false);
export {
	BROWSE_RIGHT_SLIDE_OVER_OPEN,
	BROWSE_DATA,
	BROWSE_SETTINGS,
	BROWSE_TYPE,
	BROWSE_PATH,
	BROWSE_SORT,
	BROWSE_SELECTED,
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
	INIT_DONE,
};
