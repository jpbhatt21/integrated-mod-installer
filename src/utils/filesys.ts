import { open } from "@tauri-apps/plugin-dialog";
import { copyFile, exists, mkdir, readDir, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "./utils";
import { error, info } from "@/lib/logger";
import { exts, GAME_NAMES, UNCATEGORIZED } from "./consts";
import { CONFIG, DOWNLOAD_LIST, store } from "./vars";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "./types";

export async function selectPath(
	options = { multiple: false, directory: false } as {
		multiple?: boolean;
		directory?: boolean;
		defaultPath?: string;
		title?: string;
		filters?: { name: string; extensions: string[] }[];
	}
) {
	return await open(options);
}
export function folderSelector(path = "", title: string | undefined = undefined) {
	return selectPath({ directory: true, ...(path ? { defaultPath: path } : {}), ...(title ? { title } : {}) });
}
function formatDateTime() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(
		2,
		"0"
	)}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
		now.getSeconds()
	).padStart(2, "0")}`;
}

export async function saveConfig(config = store.get(CONFIG)) {
	await writeTextFile("config.json", JSON.stringify(config, null, 2));
}
/**
 * Optimized sorting function using Intl.Collator for better performance
 * Handles case-insensitive sorting with uppercase precedence for same letters
 */
async function copyDir(src: string, dest: string, withProgress = false) {
	try {
		await mkdir(dest, { recursive: true });
		const entries = await readDir(src);
		for (const entry of entries) {
			const srcPath = `${src}/${entry.name}`;
			const destPath = `${dest}/${entry.name}`;
			if (!entry.isDirectory) {
				await copyFile(srcPath, destPath);
			} else {
				await copyDir(srcPath, destPath, withProgress);
			}
		}
	} catch (error) {}
}

export function openFile(relPath: string) {
	openPath(join(relPath));
}
export async function getTypesFromPath(path: string) {
	const data = {} as any;
	let entries = await readDir(path);
	data.entries = entries;
	data.txtCount = entries.filter((entry) => entry.name.endsWith(".txt") && !entry.isDirectory).length;
	data.imgCount = entries.filter((entry: any) => {
		const ext = entry.name.split(".").slice(-1)[0].toLowerCase();
		return exts.includes(ext) && !entry.isDirectory;
	}).length;
	data.iniCount = entries.filter((entry) => entry.name.endsWith(".ini") && !entry.isDirectory).length;
	data.dirs = entries.filter((entry) => entry.isDirectory);
	return data;
}
export async function validateModDownload(item: DownloadItem) {
	const config = store.get(CONFIG);
	let path = join("downloads", item.key);
	console.log("[IMM] Validating mod download at path:", item);
	try {
		console.log("[IMM] Reading directory entries for validation...");
		let data = await getTypesFromPath(path);
		while (data.entries.length - data.txtCount - data.imgCount === 1 && !data.iniCount && data.dirs.length === 1) {
			const uuid = "IMM_TEMP_" + Math.floor(Math.random() * 1000000000);
			const tempPath = path + "\\" + uuid;
			const dirPath = path + "\\" + data.dirs[0].name;
			try {
				await rename(dirPath, tempPath);
				await copyDir(tempPath, path);
				await remove(tempPath, { recursive: true });
			} catch (err) {
				error("[IMM] Error flattening mod directory structure:", err);
			}
			data = await getTypesFromPath(path);
		}
		if (!item.category) item.category = UNCATEGORIZED;
		if (!item.name) item.name = "Mod_" + Date.now().toString();
		if (!(await exists(item.gamePath))) return;
		const base = item.categorized ? join(item.gamePath, item.category) : item.gamePath;
		const dest = join(base, item.name);
		await mkdir(base, { recursive: true });
		try {
			await remove(dest, { recursive: true });
		} catch {}
		await rename(path, dest);
		if (config.source) {
			// const fileData = `Name: ${item.name}\nMod Link: ${item.source}\nFile Link: ${item.file}\nPreview Link: ${item.preview}\nInstalled At: ${formatDateTime()}`;
			const newFileData = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${item.source}">
  <title>Redirecting...</title>
  <link rel="canonical" href="${item.source}">
</head>
<body>
  <p id="createdAt-${formatDateTime()}">If you are not redirected automatically, follow this <a href="${item.source}">Link to Mod: ${item.name} for ${GAME_NAMES[item.game]} on Gamebanana.</a>.</p>
</body>
</html>`;
			await writeTextFile(join(dest, "open_mod_page.html"), newFileData);
		}
	} catch {}
}

export async function installFromArchives(archives: string[]) {
	let success = 0;
	async function extractArchive(archive: string) {
		if (!archive) return;
		const [name] = archive.split("\\").pop()!.split(".");
		const root = join(UNCATEGORIZED);
		await mkdir(root, { recursive: true });
		let counter = 0;
		let finalName = name;
		while (await exists(join(root, finalName))) {
			finalName = `${name} (${++counter})`;
		}
		const dest = join(root, finalName);
		await mkdir(dest, { recursive: true });
		try {
			info("[IMM] Extracting archive:", archive, "to", dest);
			const element = {
				name: finalName,
				path: UNCATEGORIZED + "\\" + finalName,
				source: "",
				fname: archive.split("\\").pop()!,
				category: UNCATEGORIZED,
				updatedAt: 0,
				dlPath: dest,
				key: `${finalName}_${archive.split("\\").pop()!}_${finalName}_0`,
			} as any;
			store.set(DOWNLOAD_LIST, (prev) => {
				prev.extracting.push(element);
				return { ...prev };
			});
			// addToExtracts(element.key, element);
			await invoke("extract_archive", {
				filePath: archive,
				savePath: dest,
				fileName: name,
				del: false,
				emit: true,
				key: element.key,
				currentSid: 999,
			});
			info("[IMM] Archive extracted:", archive);
			// await validateModDownload(dest, true);
			success++;
		} catch (err) {
			error("[IMM] Error extracting archive:", err);
			// addToast({ type: "error", message: textData._Toasts.ErrInstall.replace("<item/>", name) });
		}
	}
	const extractPromises = archives.map((archive) => extractArchive(archive));
	await Promise.all(extractPromises);
	// addToast({
	// 	type: "success",
	// 	message: textData._Toasts.SuccessInstall.replace("<success/>", success.toString()).replace(
	// 		"<total/>",
	// 		archives.length.toString()
	// 	),
	// });
}
