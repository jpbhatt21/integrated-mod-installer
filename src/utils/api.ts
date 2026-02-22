// API client for communicating with Flask backend

import { VERSION } from "./consts";
import { Games } from "./types";
import GAME_DATA from "@/gameData.json";
const API_BASE_URL = "https://gamebanana.com/apiv11/";
const HEALTH_CHECK = "https://health.wwmm.bhatt.jp/health";
class ApiClient {
	private GAME = "WW";
	private CLIENT = "";
	setClient(client: string) {
		this.CLIENT = client;
	}
	constructor() {
		return this;
	}
	async makeRequest(endpoint: string, options: RequestInit = {}) {
		const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}

		return response.json();
	}
	async categories(game: Games) {
		if (game == "") return [];
		try {
			const fetchWithRetry = async (timeouts: number[] = [2000, 5000]): Promise<any> => {
				for (let i = 0; i < timeouts.length; i++) {
					try {
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), timeouts[i]);

						const response = await this.makeRequest(
							`Mod/Categories?_idCategoryRow=${GAME_DATA[game].id.categories}&_sSort=a_to_z&_bShowEmpty=true`,
							{ signal: controller.signal }
						);
						clearTimeout(timeoutId);
						if (!response) {
							throw new Error(`HTTP ${response.status}`);
						}
						return await response;
					} catch (error) {
						if (i === timeouts.length - 1) {
							throw error;
						}
					}
				}
			};
			const response = await fetchWithRetry();
			return [...response.filter((x: any) => x._idRow !== 31838), ...GAME_DATA[game].generic.categories];
		} catch (error) {
			return [];
		}
	}

	async mod(mod = "Mod/0", signal?: AbortSignal) {
		try {
			const response = await this.makeRequest(`${mod}/ProfilePage`, signal && { signal });
			return response;
		} catch (error) {
			//console.error("Failed to fetch categories:", error);
			throw error;
		}
	}

	async healthCheck() {
		// return VERSION+"/"+this.GAME+"/"+(this.CLIENT||("_"+Date.now()));
		//info(this.CLIENT, VERSION, this.GAME, this.CLIENT);
		const base = `${HEALTH_CHECK}/${VERSION || "2.0.1"}/${this.GAME || "WW"}`;
		//info(base);
		try {
			if (this.CLIENT) fetch(`${base}/${this.CLIENT}`);
			else {
				fetch(`${base}/_${Date.now()}`)
					.then((res) => res.json())
					.then((data) => {
						if (data.client) {
							this.CLIENT = data.client;
							// store.set(SETTINGS, (prev) => ({ ...prev, global: { ...prev.global, clientDate: data.client } }));
							// saveConfigs();
							// config.settings.clientDate = data.client;
							// store.set(settingsDataAtom, config.settings as Settings);
							// saveConfig();
						}
					});
			}
		} catch (error) {
			//console.error("Health check failed:", error);
		}
	}
}
export const apiClient = new ApiClient();
