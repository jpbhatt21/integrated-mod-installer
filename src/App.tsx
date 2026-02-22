import "./App.css";
import ToastProvider from "./_Toaster/ToastProvider";
import { AudioLinesIcon, HardDriveDownloadIcon, RefreshCcwIcon, SettingsIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Updates from "./pages/Updates";
import { ScrollArea } from "./components/ui/scroll-area";
import { Button } from "./components/ui/button";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { fetchMod, formatBytes, join, modRouteFromURL, sanitizeFileName, serializeDownloads } from "./utils/utils";
import { useAtom, useAtomValue } from "jotai";
import { CATEGORIES, CONFIG, DOWNLOAD_LIST, store } from "./utils/vars";
import { DownloadItem, Games, OnlineMod } from "./utils/types";
import { GAME_GB_IDS, GAME_NAMES, UNCATEGORIZED } from "./utils/consts";
import { exists } from "@tauri-apps/plugin-fs";
import { AlertDialog } from "@radix-ui/react-alert-dialog";
import { AlertDialogContent } from "./components/ui/alert-dialog";
import { listen } from "@tauri-apps/api/event";
import { validateModDownload } from "./utils/filesys";
type Page = "dashboard" | "settings" | "updates";
interface Action {
	title: string;
	type: "destructive" | "warn" | "success" | "default";
	func: () => Promise<void>;
}
interface PendingAction {
	title: string;
	description: string;
	actions: Action[];
	type: "destructive" | "warn" | "success" | "default";
}
const appWindow = getCurrentWindow();

const navItems = [
	{
		id: "dashboard" as Page,
		label: "Downloads",
		icon: <HardDriveDownloadIcon />,
	},
	{
		id: "settings" as Page,
		label: "Settings",
		icon: <SettingsIcon />,
	},
	{
		id: "updates" as Page,
		label: "Updates",
		icon: <RefreshCcwIcon />,
	},
];
const prev: {
	[key: string]: {
		perct: number;
		text: string;
		lastUpdate: number;
	};
} = {};
function App() {
	const [currentPage, setCurrentPage] = useState<Page>("dashboard");
	const [wallpaper, setWallpaper] = useState<string>("");
	const wallpaperRef = useRef<HTMLDivElement>(null);
	const categories = useAtomValue(CATEGORIES);
	const config = useAtomValue(CONFIG);
	const [urlQueue, setUrlQueue] = useState<string[]>([]);
	const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
	const [downloads, setDownloads] = useAtom(DOWNLOAD_LIST);
	const elementRefs = useRef<{
		[key: string]: {
			background: HTMLDivElement | null;
			text: HTMLDivElement | null;
		};
	}>({});
	async function modExists(
		root: string,
		item: DownloadItem,
		categorized: boolean,
		downloads = store.get(DOWNLOAD_LIST)
	) {
		const path = join(root, item.name);
		let res = await exists(path);
		if (!res) {
			res = serializeDownloads(downloads).find(
				(d) => d.gamePath == item.gamePath && d.name == item.name && d.categorized == categorized
			)
				? true
				: false;
		}
		return res;
	}
	async function addToDownloads(url: string, ele?: any) {
		const game: Games = ele ? ele.game : GAME_GB_IDS[url.split("game/").pop()?.split("/").shift() as any] || "";
		if (!ele) {
			const mod = url.split("mods/").pop()?.split("/").shift() || "";
			const fileId = url.split("dl/").pop()?.split("/").shift() || "";
			const item = (await fetchMod(modRouteFromURL(url))) as OnlineMod;
			const category =
				categories[game]?.find((cat) => cat._idRow == item._aCategory._idRow)?._sName ||
				categories[game]?.find((cat) => cat._idRow == item._aSuperCategory._idRow)?._sName ||
				UNCATEGORIZED;
			const key = Date.now().toString() + game + mod + fileId;
			const { _sDownloadUrl: file, _sFile: fname } = item._aFiles?.find((f: any) => f._idRow == fileId);
			ele = {
				game,
				gamePath: "",
				key,
				status: "pending",
				preview:
					item._aPreviewMedia && item._aPreviewMedia._aImages && item._aPreviewMedia._aImages.length > 0
						? item._aPreviewMedia._aImages[0]._sBaseUrl + "/" + item._aPreviewMedia._aImages[0]._sFile
						: "",
				category,
				source: item._sProfileUrl || "",
				file,
				fname,
				name: sanitizeFileName(item._sName),
			};
		}

		const addToQueue = config.paths[game] && config.paths[game] != "" && (await exists(config.paths[game]));
		if (addToQueue) {
			ele.gamePath = config.paths[game];
			const root = join(ele.gamePath, config.categorized ? ele.category : "");
			if (await modExists(root, ele, config.categorized)) {
				setPendingActions((prev) => [
					...prev,
					{
						title: "Mod Already Exists",
						type: "warn",
						description: `The mod "${ele.name}" already exists in the directory for ${GAME_NAMES[game]}.`,
						actions: [
							{
								title: "Skip Mod",
								type: "default",
								func: async () => {},
							},
							{
								title: "Overwrite & Update",
								type: "destructive",
								func: async () => {
									setDownloads((prev: any) => {
										prev.queue.push(ele);
										return { ...prev };
									});
								},
							},
							{
								title: "Rename & Install",
								type: "success",
								func: async () => {
									let counter = 1;
									const initialName = ele.name;
									const categorized = config.categorized;
									const downloads = store.get(DOWNLOAD_LIST);
									while (await modExists(root, ele, categorized, downloads)) {
										ele.name = `${initialName} (${counter})`;
										counter++;
									}
									setDownloads((prev: any) => {
										prev.queue.push(ele);
										return { ...prev };
									});
								},
							},
						],
					},
				]);
				return;
			}
		}
		setDownloads((prev: any) => {
			if (addToQueue) {
				prev.queue.push(ele);
			} else {
				prev.failed.push(ele);
				setCurrentPage("settings");
				setPendingActions((prev) => [
					...prev,
					{
						title: "Invalid Mod Directory",
						type: "destructive",
						description: `The mod directory for ${GAME_NAMES[game]} is invalid or inaccessible.`,
						actions: [
							{
								title: "Okay",
								type: "destructive",
								func: async () => {},
							},
						],
					},
				]);
			}
			return { ...prev };
		});
	}
	async function startDownload(item: DownloadItem) {
		prev[item.key] = {
			perct: 0,
			text: "",
			lastUpdate: Date.now(),
		};
		console.log(`Starting download for ${item.name} with key ${item.key} from ${item.file}`);
		if (item?.preview && config.preview) {
			invoke("download_and_unzip", {
				fileName: "preview",
				downloadUrl: item.preview,
				savePath: item.gamePath,
				key: item.key,
				emit: false,
			});
		}
		const downloads = JSON.parse(sessionStorage.getItem("downloads") || "{}");
		downloads[item.key] = {
			...item,
			status: "downloading",
		};
		sessionStorage.setItem("downloads", JSON.stringify(downloads));
		invoke("download_and_unzip", {
			fileName: item.name,
			downloadUrl: item.file,
			savePath: item.gamePath,
			key: item.key,
			emit: true,
		});
	}
	useEffect(() => {
		const prevDownloads = JSON.parse(sessionStorage.getItem("downloads") || "{}");

		async function positioner() {
			if(!await appWindow.isFocused() || await appWindow.isMinimized()) return;
			let { x, y } = await appWindow.outerPosition();
			if (wallpaperRef.current) {
				// wallpaperRef.current.style.left = `${x}px`;
				// wallpaperRef.current.style.top = `${y}px`;
				wallpaperRef.current.style.backgroundPosition = `${-x}px ${-y}px`;
			}
		}
		function onWindowFocus() {
			let bg = document.getElementById("bg-img");
			bg && (bg.style.opacity = "1");
		}
		function onWindowBlur() {
			let bg = document.getElementById("bg-img");
			bg && (bg.style.opacity = "0");
		}
		invoke("get_wallpaper").then((data: any) => {
			setWallpaper(data);
			setTimeout(() => {
				let bg = document.getElementById("bg-img");
				bg && (bg.style.opacity = "1");
				window.addEventListener("focus", onWindowFocus);
				window.addEventListener("blur", onWindowBlur);
			}, 600);
		});
		const interval = setInterval(positioner, 100);
		let unlisten: (() => void) | undefined;
		const initDeepLink = async () => {
			const initialUrls = await getCurrent();
			const isDeepLinkHandled = sessionStorage.getItem("deep-link-initial-handled");
			console.log("Initial URLs:", initialUrls, "Handled:", isDeepLinkHandled);
			if (initialUrls && !isDeepLinkHandled) {
				// info("Launched with URLs:", initialUrls);
				sessionStorage.setItem("deep-link-initial-handled", "true");
				// await handleURLGame(initialUrls).catch(() => {
				// initialUrls.forEach((url) => addToDownloads(url));
				setUrlQueue((prev) => [...prev, ...initialUrls]);
				// });
			}
			unlisten = await onOpenUrl(async (newUrls) => {
				appWindow.setFocus();
				sessionStorage.setItem("deep-link-initial-handled", "true");
				setUrlQueue((prev) => [...prev, ...newUrls]);
			});
		};
		initDeepLink();
		listen("download-progress", (event) => {
			const payload = event.payload as any;
			const total = payload.total as number;
			const downloaded = payload.downloaded as number;
			const key = payload.key as string;
			if (prevDownloads.hasOwnProperty(key)) {
				store.set(DOWNLOAD_LIST, (prev) => {
					const already = prev.downloading.find((item: any) => item.key === key);
					if (!already) {
						const downloadElement = { ...prevDownloads[key], status: "downloading" };
						prev.downloading.push(downloadElement);
					}
					return { ...prev };
				});
				delete prevDownloads[key];
				prev[key] = {
					perct: 0,
					text: "",
					lastUpdate: 0,
				};
			}
			prev[key].perct = ((downloaded / total) * 100).toFixed(2) as unknown as number;
			prev[key].text =
				` • ${prev[key].perct}% (${formatBytes(downloaded)}/${formatBytes(total)}) • ${payload.speed} • ${
					payload.eta
				} • `;
			// Debounce speed/ETA updates to 500ms
			const now = Date.now();
			if (now - prev[key].lastUpdate >= 1000) {
				console.log(`Updating UI for key ${key}: ${prev[key].text} at ${prev[key].perct}%`, elementRefs.current);
				if (elementRefs.current[key]?.text) elementRefs.current[key].text.textContent = prev[key].text;
				prev[key].lastUpdate = now;
			}
			if (elementRefs.current[key]?.background) elementRefs.current[key].background.style.width = prev[key].perct + "%";
		});
		listen("ext", (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			setDownloads((prev) => {
				const downloadElement = prev.downloading.find((item: any) => item.key === key) || prevDownloads[key];
				prev.downloading = prev.downloading.filter((item: any) => item.key !== key);
				if (downloadElement?.key) {
					prev.extracting.push({
						...downloadElement,
						status: "extracting",
					});
				}
				return {
					...prev,
				};
			});
			if (elementRefs.current[key]) {
				delete elementRefs.current[key];
			}
			if (prev[key]) {
				delete prev[key];
			}
		});
		listen("can", (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			if (elementRefs.current[key]) {
				delete elementRefs.current[key];
			}
			if (prev[key]) {
				delete prev[key];
			}
			const downloads = JSON.parse(sessionStorage.getItem("downloads") || "{}");
			if (downloads[key]) {
				delete downloads[key];
				sessionStorage.setItem("downloads", JSON.stringify(downloads));
			}
		});
		listen("fin", async (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			const type = payload.type || ("auto" as string);
			console.log(`Download finished for key: ${key} with type: ${type}`);
			if (type == "auto") {
			} else if (type == "manual") {
			}
			setDownloads((prev) => {
				const finishedElement = JSON.parse(
					JSON.stringify(prev.extracting?.find((item: any) => item.key === key) || prevDownloads[key] || {})
				) as DownloadItem;
				prev.extracting = prev.extracting?.filter((item: any) => item.key !== key) || [];
				if (finishedElement?.key) {
					finishedElement.status = "completed";
					finishedElement.categorized = store.get(CONFIG).categorized;
					prev.completed.push({
						...finishedElement,
					});
					console.log(finishedElement);
					validateModDownload({ ...finishedElement });
				}
				return {
					...prev,
				};
			});
			const downloads = JSON.parse(sessionStorage.getItem("downloads") || "{}");
			if (downloads[key]) {
				delete downloads[key];
				sessionStorage.setItem("downloads", JSON.stringify(downloads));
			}
			return;
		});
		return () => {
			if (unlisten) unlisten();
			window.removeEventListener("focus", onWindowFocus);
			window.removeEventListener("blur", onWindowBlur);
			clearInterval(interval);
		};
	}, []);
	useEffect(() => {
		if (urlQueue.length > 0) {
			urlQueue.forEach((url) => addToDownloads(url));
			setUrlQueue([]);
		}
	}, [urlQueue]);
	const renderPage = () => {
		switch (currentPage) {
			case "settings":
				return <Settings />;
			case "updates":
				return <Updates />;
			default:
				return <Dashboard elementRefs={elementRefs} prev={prev} addToDownloads={addToDownloads} />;
		}
	};
	useEffect(() => {
		if (downloads.downloading.length < config.concDl && downloads.queue.length > 0) {
			const next = downloads.queue[0];
			setDownloads((prev: any) => {
				prev.downloading.push(next);
				prev.queue = prev.queue.filter((item: any) => item.key !== next.key);
				return { ...prev };
			});
			startDownload(next);
		}
	}, [downloads]);
	return (
		<div className="bg-sidebar fixed top-0 flex flex-col w-full h-screen overflow-hidden">
			<div
				ref={wallpaperRef}
				id="bg-img"
				className="fixed w-full h-full duration-300 bg-center opacity-0"
				style={{ backgroundImage: `url(${wallpaper})` }}
			/>
			<div className="fixed w-full h-full bg-sidebar/90 backdrop-blur-[999px] " />

			<div className="fixed flex w-full h-full pt-8">
				{/* Sidebar */}
				<div className="border-border flex flex-col w-20 h-full">
					{/* Logo/Header */}
					<div className="text-accent flex flex-col items-center justify-center py-2 pl-1 -mt-6 text-xs">
						<div className="text-accent flex items-center justify-center w-8 h-8 rounded-lg">
							{/* <img src="icon.png"/> */}
							<AudioLinesIcon className="min-w-4 min-h-4 absolute opacity-20 ml-5 text-foreground z-0 -mt-4 scale-y-200 rotate-45" />
							<svg
								width="800px"
								height="800px"
								viewBox="0 0 100 100"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
								role="img"
								className={`iconify z-1 iconify--gis ${downloads.downloading.length > 0 ? "animate-pulse" : ""}`}
								preserveAspectRatio="xMidYMid meet"
							>
								<path
									d="M49.945-.172c-.742-.004-1.149.502-1.263 1.094L37.764 37.764C25.443 41.41 13.113 45.04.814 48.717c-.64.192-.988.574-.986 1.252c.002.677.597 1.082 1.149 1.252l36.75 10.888c3.66 12.363 7.3 24.736 10.99 37.077c.192.64.574.988 1.252.986c.677-.002 1.082-.597 1.252-1.149l10.925-36.875l36.915-10.937c.734-.239 1.107-.524 1.11-1.266c.005-.742-.501-1.149-1.093-1.263L62.111 37.727L51.211.939c-.239-.734-.524-1.107-1.266-1.11zm0 14.432l7.373 24.886a5 5 0 0 0 3.373 3.374l25.047 7.423l-25.011 7.41a5 5 0 0 0-3.373 3.376l-7.409 25.003c-2.475-8.344-4.95-16.686-7.424-25.043a5 5 0 0 0-3.373-3.375l-24.877-7.37c8.301-2.463 16.6-4.925 24.913-7.385a5 5 0 0 0 3.375-3.375z"
									fill="currentColor"
									fill-rule="evenodd"
								></path>
								<path
									d="M50 40a10 10 0 0 1 10 10a10 10 0 0 1-10 10a10 10 0 0 1-10-10a10 10 0 0 1 10-10z"
									fill="currentColor"
									fill-rule="evenodd"
								></path>
								<path
									d="M84.596 14.1a1.434 1.434 0 0 0-.825.265l-21.113 11.46c.821 2.928 1.677 5.835 2.65 8.677l8.86 2.625l11.379-20.961c.35-.689.412-1.154-.11-1.682c-.26-.263-.552-.378-.841-.384zm-69.301.007c-.262.027-.511.155-.75.395c-.478.48-.342 1.187-.072 1.697l11.404 21.008c2.913-.817 5.812-1.668 8.66-2.637l2.621-8.843c-7.009-3.81-14.018-7.63-21.031-11.415c-.295-.158-.57-.231-.832-.205zm58.877 48.545c-2.98.832-5.93 1.7-8.8 2.694c-.853 2.925-1.73 5.845-2.602 8.765l21.064 11.436c.689.35 1.154.412 1.682-.11c.527-.521.456-1.166.119-1.666L74.172 62.652zm-48.39.086c-3.83 7.044-7.666 14.085-11.47 21.133c-.317.59-.29 1.106.19 1.584s1.187.342 1.697.072l21.008-11.404c-.828-2.956-1.691-5.897-2.674-8.787c-2.92-.85-5.836-1.727-8.752-2.598z"
									fill="var(--muted-foreground)"
									fill-rule="evenodd"
								></path>
							</svg>
						</div>
					</div>
{/* <div className="border-border bg-black flex flex-col w-80 h-full">
					
					<div className="text-accent flex flex-col items-center justify-center py-2 pl-1 -mt-6 text-xs">
						<div className="text-accent p-4 pt-4 pb-3 pr-4.25 pl-2.75 ml-20 bg-input flex items-center justify-center w-14 h-14 scale-300 my-20 rounded">
							
							<AudioLinesIcon className="min-w-4 min-h-4 absolute opacity-20 ml-5 text-foreground z-0 -mt-4 scale-y-200 rotate-45" />
							<svg
								width="800px"
								height="800px"
								viewBox="0 0 100 100"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
								role="img"
								className={`iconify z-1 iconify--gis ${downloads.downloading.length > 0 ? "animate-pulse" : ""}`}
								preserveAspectRatio="xMidYMid meet"
							>
								<path
									d="M49.945-.172c-.742-.004-1.149.502-1.263 1.094L37.764 37.764C25.443 41.41 13.113 45.04.814 48.717c-.64.192-.988.574-.986 1.252c.002.677.597 1.082 1.149 1.252l36.75 10.888c3.66 12.363 7.3 24.736 10.99 37.077c.192.64.574.988 1.252.986c.677-.002 1.082-.597 1.252-1.149l10.925-36.875l36.915-10.937c.734-.239 1.107-.524 1.11-1.266c.005-.742-.501-1.149-1.093-1.263L62.111 37.727L51.211.939c-.239-.734-.524-1.107-1.266-1.11zm0 14.432l7.373 24.886a5 5 0 0 0 3.373 3.374l25.047 7.423l-25.011 7.41a5 5 0 0 0-3.373 3.376l-7.409 25.003c-2.475-8.344-4.95-16.686-7.424-25.043a5 5 0 0 0-3.373-3.375l-24.877-7.37c8.301-2.463 16.6-4.925 24.913-7.385a5 5 0 0 0 3.375-3.375z"
									fill="currentColor"
									fill-rule="evenodd"
								></path>
								<path
									d="M50 40a10 10 0 0 1 10 10a10 10 0 0 1-10 10a10 10 0 0 1-10-10a10 10 0 0 1 10-10z"
									fill="currentColor"
									fill-rule="evenodd"
								></path>
								<path
									d="M84.596 14.1a1.434 1.434 0 0 0-.825.265l-21.113 11.46c.821 2.928 1.677 5.835 2.65 8.677l8.86 2.625l11.379-20.961c.35-.689.412-1.154-.11-1.682c-.26-.263-.552-.378-.841-.384zm-69.301.007c-.262.027-.511.155-.75.395c-.478.48-.342 1.187-.072 1.697l11.404 21.008c2.913-.817 5.812-1.668 8.66-2.637l2.621-8.843c-7.009-3.81-14.018-7.63-21.031-11.415c-.295-.158-.57-.231-.832-.205zm58.877 48.545c-2.98.832-5.93 1.7-8.8 2.694c-.853 2.925-1.73 5.845-2.602 8.765l21.064 11.436c.689.35 1.154.412 1.682-.11c.527-.521.456-1.166.119-1.666L74.172 62.652zm-48.39.086c-3.83 7.044-7.666 14.085-11.47 21.133c-.317.59-.29 1.106.19 1.584s1.187.342 1.697.072l21.008-11.404c-.828-2.956-1.691-5.897-2.674-8.787c-2.92-.85-5.836-1.727-8.752-2.598z"
									fill="var(--muted-foreground)"
									fill-rule="evenodd"
								></path>
							</svg>
						</div>
					</div> */}
					{/* Navigation */}

					<div className="z-20 flex flex-col items-center w-full h-full gap-1 p-2 pl-3 font-bold pointer-events-auto">
						{navItems.map((item) => (
							<Button
								key={item.id}
								variant={currentPage === item.id ? "default" : "ghost"}
								className={`w-full aspect-square flex-col pointer-events-auto justify-center text-xs min-h-fit gap-0.5 ${
									currentPage === item.id
										? "bg-accent/90 text-background hover:brightness-110"
										: "text-muted-foreground hover:text-background hover:bg-accent/50"
								}`}
								onClick={() => setCurrentPage(item.id)}
							>
								<div
								className="duration-300"
								style={{
										transform: currentPage == item.id ? "scale(1.15)" : "scale(1)",
									
								}}
								>
									{item.icon}
								</div>
								<label
									className="duration-200"
									style={{
										opacity: currentPage == item.id ? "0" : "1",
										transform: currentPage == item.id ? "scale(0.7)" : "scale(0.9)",
										marginBottom: currentPage == item.id ? "-18px" : "0px",
									}}
								>
									{item.label}
								</label>
							</Button>
						))}
					</div>
				</div>

				{/* Main Content */}
				<div className="flex-1 rounded-xl p-2  m-2 ml-1 mt-0 h-full max-h-[calc(100vh-2.5rem)] bg-muted-foreground/3 overflow-hidden">
					<ScrollArea className="h-full rounded-md">{renderPage()}</ScrollArea>
				</div>
			</div>
			<AlertDialog open={pendingActions.length > 0}>
				<AlertDialogContent className="py-0">
					{pendingActions.length > 0 && (
						<div className="text-foreground/75 flex flex-col items-center gap-4 p-4">
							<h2 className={`text-accent text-2xl font-bold text-${pendingActions[0].type}`}>
								{pendingActions[0].title}
							</h2>
							<p className=" text-center">{pendingActions[0].description}</p>
							<div
								className="flex w-full gap-2"
								style={{
									justifyContent: pendingActions.length > 1 ? "space-between" : "center",
								}}
							>
								{pendingActions[0].actions.map((action) => (
									<Button
										key={action.title}
										variant={action.type}
										onClick={async () => {
											try {
												await action.func();
												setPendingActions((prev) => [...prev.slice(1)]);
											} catch {}
										}}
									>
										{action.title}
									</Button>
								))}
							</div>
						</div>
					)}
					{pendingActions.length == 0 && (
						<div className="space-y-4">
							<h2 className="text-lg font-semibold">No Pending Actions</h2>
							<p className="text-muted-foreground text-sm">There are currently no pending actions to display.</p>
							<div className="flex justify-end gap-2">
								<Button
									variant="destructive"
									onClick={async () => {
										try {
											setPendingActions([]);
										} catch {}
									}}
								>
									Close
								</Button>
							</div>
						</div>
					)}
				</AlertDialogContent>
			</AlertDialog>
			<ToastProvider />
		</div>
	);
}
export default App;
