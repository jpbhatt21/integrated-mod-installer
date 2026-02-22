import { apiClient } from "./api";

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
	let result = parts.filter((part) => part !== "").join("\\").replace("/", "\\").replaceAll("\\\\", "\\");
	result = result.endsWith("\\") ? result.slice(0, -1) : result;
	result = result.startsWith("\\") ? result.slice(1) : result;
	return result;
}
const reservedWindowsNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
const illegalCharacters = /[<>:"/\\|?*\x00-\x1F]/g;
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