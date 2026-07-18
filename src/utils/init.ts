import { apiClient } from "./api";
import { GAMES, VERSION } from "./consts";
import { Category, Games } from "./types";
import { CATEGORIES, CONFIG, ERR, FIRST_LOAD, INIT_DONE, store, UPDATE } from "./vars";
import defConfig from "../default.json";
import { path } from "@tauri-apps/api";
import { exists, mkdir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "./utils";
import { check } from "@tauri-apps/plugin-updater";
async function getXXMIConfig(path: string) {
	try {
		return JSON.parse(await readTextFile(join(path, "XXMI Launcher Config.json")));
	} catch (e) {
		// info("[IMM] Failed to read XXMI Launcher config:", e);
		return null;
	}
}
let paths = {
	"": "",
	WW: "",
	ZZ: "",
	GI: "",
	SR: "",
	XX: "",
	EF: "",
};
let config = { ...defConfig };
export async function readXXMIConfig(path: string) {
	paths = {
		"": "",
		WW: "",
		ZZ: "",
		GI: "",
		SR: "",
		XX: "",
		EF: "",
	};
	if (path && path != "") {
		const data = await getXXMIConfig(path);
		if (!data) return false;
		GAMES.forEach((game) => {
			if (data.Importers[game + "MI"]) {
				const xxPath = (data.Importers[game + "MI"].Importer.importer_folder || "").replace(/\\/g, "/");
				paths[game as Games] = xxPath == `${game}MI/` ? join(path, `${game}MI`) : join(...xxPath.split("/"));
			}
		});
		paths.XX = path;
		return true;
	}
	return false;
}
async function initCategories() {
	const promises = GAMES.map(async (game) => {
		if (!game)
			return {
				game,
				categories: [] as Category[],
			};
		return {
			game,
			categories: await apiClient.categories(game),
		};
	});
	const results = await Promise.all(promises);
	console.log("[IMM] Categories initialized:", results);
	store.set(CATEGORIES, (prev) => {
		const newCategories = { ...prev };
		results.forEach(({ game, categories }: { game: Games; categories: Category[] }) => {
			if (categories && categories.length > 0) newCategories[game] = categories;
		});
		return newCategories;
	});
}
export async function getModDir(overwrite = false) {
	const promises = GAMES.map(async (game) => {
		console.log(`[IMM] Setting up mod directory for ${game}...`);
		if (game && paths[game] && (overwrite || !(await exists(config.paths[game])))) {
			console.log(`[IMM] Creating mod directory for ${game} at ${config.paths[game]}...`);
			try {
				config.paths[game] = join(paths[game], "Mods");
				await mkdir(config.paths[game], { recursive: true });
			} catch (e) {
				config.paths[game] = "";
			}
		}
	});
	await Promise.all(promises);
	if (overwrite) store.set(CONFIG, config);
}
export async function checkForUpdates() {
	apiClient.healthCheck()
	try {
		const update =  await check({ target: "windows-x86_64" });
		store.set(UPDATE,{
			currentVersion:VERSION,
			latestVersion: update?.version || VERSION,
			hasUpdate: Boolean(update),
			releaseNotes: JSON.parse(update?.body || "null"),
			update: update || undefined,
		});
	} catch (error) {
		store.set(UPDATE, (prev) => ({ ...prev, error: String(error) }));
	}
}
export async function main() {
	try {
		store.set(INIT_DONE, false);
		initCategories();
		if (JSON.parse(sessionStorage.getItem("firstLoad") || '"true"') === "true") {
			sessionStorage.setItem("firstLoad", "false");
			remove("downloads", { recursive: true }).finally(() => mkdir("downloads"));
		}
		let appData = await path.dataDir();
		const XXMI = `${appData}\\XXMI Launcher`;
		if (!(await exists("config.json"))) {
			store.set(FIRST_LOAD, true);
			await writeTextFile("config.json", JSON.stringify(defConfig, null, 2));
		}
		try {
			config = {
				...config,
				...JSON.parse(await readTextFile("config.json")),
			};
			if(config.clientDate) apiClient.setClient(config.clientDate);
		} catch (e) {
			config = { ...defConfig };
		}
		if ((config.XXMI == "" || !(await exists(config.XXMI))) && (await exists(XXMI))) {
			config.XXMI = XXMI;
		}
		sessionStorage.setItem("minimizeToTray", config.minimizeToTray ? "true" : "false");
		paths.XX = config.XXMI;
		await readXXMIConfig(config.XXMI || "");
		config.version = defConfig.version;
		await getModDir();
		await writeTextFile("config.json", JSON.stringify(config, null, 2));
		store.set(CONFIG, config);
		store.set(INIT_DONE, true);
	} catch (e) {
		store.set(ERR, `Initialization failed: ${e}`);
	}
	checkForUpdates()
}
