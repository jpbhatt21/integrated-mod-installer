import { apiClient } from "./api";
import { IMAGE_SERVER } from "./consts";
import { Games } from "./types";
import { BROWSE_DATA, BROWSE_RIGHT_SLIDE_OVER_OPEN, BROWSE_SELECTED, FILE_TO_DL, store } from "./vars";
const illegalCharacters = /[<>:"/\\|?*\x00-\x1F]/g;
export function safeLoadJson(cur: any, neww: any) {
	if (!cur || !neww) return;
	Object.keys(neww).forEach((key) => {
		if (typeof neww[key] === "object" && !Array.isArray(neww[key])) {
			cur[key] = safeLoadJson(cur[key], neww[key]) || cur[key] || {};
		} else {
			cur[key] = neww[key];
		}
	});
	return cur;
}
export function sanitizeFileName(input: string, options: any = {}): string {
	const { replacement = "_", defaultName = "untitled", maxLength = 255 } = options;

	if (typeof input !== "string") {
		return defaultName;
	}

	let sanitized = input.replace(illegalCharacters, replacement);

	const baseName = sanitized.split(".")[0];
	if (reservedWindowsNames.test(baseName)) {
		sanitized = replacement + sanitized;
	}

	sanitized = sanitized.trim().replace(/^[.]+|[.]+$/g, "");

	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);

		sanitized = sanitized.trim().replace(/^[.]+|[.]+$/g, "");
	}

	if (sanitized.length === 0) {
		return defaultName;
	}
	return sanitized;
}
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>, hideOnError = false): void {
	const target = event.currentTarget;
	if (hideOnError) {
		target.style.opacity = "0";
		target.classList.remove("fadein");
	} else target.style.opacity = "0.5";
	target.src = `/IMI.png`;
}
export function serializeDownloads(downloads: any) {
	let downloadList = [];
	if (downloads?.downloading)
		downloadList.push(...downloads.downloading.map((item: any) => ({ ...item, status: "downloading" })));
	if (downloads?.extracting)
		downloadList.push(...downloads.extracting.map((item: any) => ({ ...item, status: "extracting" })));
	if (downloads?.queue) downloadList.push(...downloads.queue.map((item: any) => ({ ...item, status: "pending" })));
	if (downloads?.completed)
		downloadList.push(...downloads.completed.map((item: any) => ({ ...item, status: "completed" })));
	if (downloads?.failed) downloadList.push(...downloads.failed.map((item: any) => ({ ...item, status: "failed" })));
	return downloadList;
}

export function join(...parts: string[]) {
	let result = parts
		.filter((part) => part !== "")
		.join("\\")
		.replace("/", "\\")
		.replaceAll("\\\\", "\\");
	result = result.endsWith("\\") ? result.slice(0, -1) : result;
	result = result.startsWith("\\") ? result.slice(1) : result;
	return result;
}
const reservedWindowsNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

export function formatSize(size: number): string {
	return size < 100
		? size.toFixed(2) + "B"
		: size < 100000
			? (size / 1000).toFixed(2) + "KB"
			: size < 100000000
				? (size / 1000000).toFixed(2) + "MB"
				: (size / 1000000000).toFixed(2) + "GB";
}
export function preventContextMenu(event: React.MouseEvent): void {
	event.preventDefault();
	// event.currentTarget.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true }));
}
export function getTimeDifference(startTimestamp: number, endTimestamp: number) {
	const secInMinute = 60;
	const secInHour = secInMinute * 60;
	const secInDay = secInHour * 24;
	const secInYear = secInDay * 365;
	const diff = Math.abs(endTimestamp - startTimestamp);
	if (diff < secInMinute) {
		return "now";
	} else if (diff < secInHour) {
		const minutes = Math.floor(diff / secInMinute);
		return minutes + "m";
	} else if (diff < secInDay) {
		const hours = Math.floor(diff / secInHour);
		return hours + "h";
	} else if (diff < secInYear) {
		const days = Math.floor(diff / secInDay);
		return days + "d";
	} else {
		const years = Math.floor(diff / secInYear);
		return years + "y";
	}
}
export async function fetchMod(selected: string, signal?: AbortSignal) {
	let modData = {};
	// console.log("Fetching mod data for", selected);
	await apiClient.mod(selected, signal).then((data) => {
		// console.log("Fetched mod data for", selected, data);
		if (data._idRow != selected.split("/").slice(-1)[0]) return;
		modData = data;
	});
	return modData;
}
let IMAGE_SERVER_URL = IMAGE_SERVER;

export function setImageServer(url: string) {
	IMAGE_SERVER_URL = url;
}
export function getImageUrl(path: string): string {
	return `${IMAGE_SERVER_URL}/${path}`;
}
export async function fetchModwithUpdates(game: Games, selected: string, controller?: AbortController) {
	let allData = {};
	//info(selected);
	await apiClient.updates(selected, controller?.signal).then(async (data) => {
		await apiClient.mod(selected, controller?.signal).then((data2) => {
			let updates =
				data._aRecords?.map((record: any) => ({
					_sText: record._sText,
					_sVersion: record._sVersion,
					_sDate: record._tsDateModified || record._tsDateAdded,
					_aChangeLog: record._aChangeLog,
					_sName: record._sName,
				})) || [];
			data2._aUpdates = updates;
			if (data._aRecords && data._aRecords.length > 0) {
				data2._eUpdate = true;
				data2._sUpdateText = data._aRecords[0]._sText;
				data2._sUpdateVersion = data._aRecords[0]._sVersion;
				data2._sUpdateDate = data._aRecords[0]._tsDateModified || data._aRecords[0]._tsDateAdded;
				data2._aUpdateChangeLog = data._aRecords[0]._aChangeLog;
				data2._sUpdateName = data._aRecords[0]._sName;
			}
			if (data2._idRow != selected.split("/").slice(-1)[0]) return;
			allData = data2;
			store.set(BROWSE_DATA, (prev) => {
				return {
					...prev,
					[game]: {
						...prev[game],
						[selected]: data2,
					},
				};
			});
		});
	});
	return allData;
}
const sizeLabels = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
export function formatBytes(bytes: number, size = 0): string {
	return bytes >= 1024 ? formatBytes(bytes / 1024, size + 1) : `${Math.round(bytes * 100) / 100} ${sizeLabels[size]}`;
}
export function modRouteFromURL(url: string): string {
	let modId = url?.split("mods/").pop()?.split("/")[0] || "";
	return modId ? "Mod/" + modId : "";
}
export function isOlderThanOneDay(dateStr: string) {
	const updateAgeMs = Date.now() - (dateStr ? new Date(dateStr).getTime() : 0);
	return Number.isFinite(updateAgeMs) && updateAgeMs > 86_400_000;
}
export function handleInAppLink(url: string) {
	if (url.startsWith("imm://mode/")) return;
	if (url.startsWith("imm://")) {
		url = url.replace("imm://", "");
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		const temp = url.split("/dl/");
		url = temp[0];
		if (temp[1]) {
			store.set(FILE_TO_DL, temp[1]);
		}
	}
	console.log("[IMM] Handling in-app link:", url);
	if (!url.startsWith("http")) return;
	let mod = modRouteFromURL(url);
	if (mod) {
		store.set(BROWSE_SELECTED, mod);
		store.set(BROWSE_RIGHT_SLIDE_OVER_OPEN, true);
	}
}
