import { addToast } from "@/_Toaster/ToastProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GAME_ICONS, GAME_NAMES } from "@/utils/consts";
import { Games } from "@/utils/types";
import { join, serializeDownloads } from "@/utils/utils";
import { CONFIG, DOWNLOAD_LIST } from "@/utils/vars";
import { invoke } from "@tauri-apps/api/core";
import { exists } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useAtom, useAtomValue } from "jotai";
import {
	CheckIcon,
	ClockIcon,
	FileQuestionIcon,
	FolderArchiveIcon,
	FolderIcon,
	LinkIcon,
	Loader2Icon,
	RefreshCcwIcon,
	SquareIcon,
	XIcon,
} from "lucide-react";

const Icons = {
	pending: <ClockIcon className="min-h-4 min-w-4 max-w-4" />,
	downloading: <Loader2Icon className="min-h-4 min-w-4 max-w-4 animate-spin" />,
	completed: <CheckIcon className="min-h-4 min-w-4 max-w-4" />,
	failed: <XIcon className="min-h-4 min-w-4 max-w-4 text-destructive" />,
	extracting: <FolderArchiveIcon className="min-h-4 min-w-4 max-w-4 animate-pulse" />,
};
export default function Dashboard({
	elementRefs,
	prev,
	addToDownloads,
}: {
	elementRefs: any;
	prev: any;
	addToDownloads: (url: string, item: any) => void;
}) {
	const config = useAtomValue(CONFIG);
	const [downloads, setDownloads] = useAtom(DOWNLOAD_LIST);
	const cancelDownload = (key: number, type = "completed") => {
		if (type == "downloading" || type == "extracting") {
			invoke("cancel_install", { key });
			setDownloads((prev: any) => {
				const item = prev[type].find((i: any) => i.key == key);
				if (item?.key) {
					prev[type] = prev[type].filter((i: any) => i.key != key);
					prev.failed.push(item);
				}
				return { ...prev };
			});
		} else {
			setDownloads((prev: any) => {
				prev[type] = prev[type].filter((i: any) => i.key != key);
				return { ...prev };
			});
		}
	};
	const retryMod = async (key: number) => {
		const item = downloads.failed.find((i: any) => i.key == key);
		if (item?.key) {
			if (config.paths[item.game] && config.paths[item.game] != "" && (await exists(config.paths[item.game]))) {
				setDownloads((prev: any) => {
					prev.failed = prev.failed.filter((i: any) => i.key != key);
					return { ...prev };
				});
				addToDownloads(item.source, item);
			} else {
				addToast({
					message: `Select valid directory for ${GAME_NAMES[item.game]}`,
					type: "error",
				});
			}
		}
	};

	// const done = downloads?.completed?.length || 0;
	let downloadList = serializeDownloads(downloads);
	return (
		<div className="w-full relative flex flex-col p-4 space-y-4 min-h-[calc(100vh-3.5rem)] h-[calc(100vh-3.5rem)]">
			<div className="flex items-end justify-between">
				<div>
					<h1 className="text-2xl font-bold">Downloads</h1>
					<p className="text-muted-foreground">Install mods from gamebanana</p>
				</div>
				<Button
					className="border-border/30 border"
					onClick={() => {
						setDownloads((prev) => {
							prev.completed = [];
							return { ...prev };
						});
					}}
				>
					Clear Completed
				</Button>
			</div>
			{downloadList.length > 0 ? (
				<div className="border-border/30 bg-background/10 w-full  h-full overflow-y-auto border rounded-lg shadow">
					{downloadList.map((item, index) => (
						<div
							key={item.name?.replaceAll("DISABLED_", "") + index}
							className={`hover:bg-inpu t/10 hover:border-border duration-200 relative min-h-16 flex border-border/0 border-b-border/30 border items-center justify-between w-full px-4 ${index % 2 == 0 ? "bg-[#1b1b1b50]" : "bg-[#31313150]"}`}
						>
							{item.status == "downloading" && (
								<div
									className="bg-accent/10 outline outline-accent/10 pointer-events-none absolute top-0 left-0 w-0 h-full"
									ref={(ele) => {
										if (!elementRefs.current[item.key]) {
											elementRefs.current[item.key] = { background: null, text: null };
										}
										elementRefs.current[item.key].background = ele;
									}}
									style={{
										width: prev[item.key]?.perct ? `${prev[item.key].perct}%` : "0%",
									}}
								/>
							)}
							<div className=" flex items-center flex-1 w-full gap-3">
								{Icons[item.status as keyof typeof Icons] || <FileQuestionIcon className="min-h-4 min-w-4" />}
								<div className="flex flex-col flex-1 w-full">
									<div className="flex items-center gap-1">
										<Label
											className="focus:border-0 border-border/0 text-ellipsis w-fit hover:text-accent max-w-[calc(100vw-350px)]  h-8 overflow-hidden text-white rounded-none cursor-default"
											style={{ backgroundColor: "#fff0" }}
											onClick={(e) => {
												(e.currentTarget.parentElement?.lastElementChild as HTMLButtonElement)?.click();
											}}
										>
											{item.name?.replaceAll("DISABLED_", "")}
										</Label>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => {
												let a = document.createElement("a");
												a.href = item.source;
												a.target = "_blank";
												document.body.appendChild(a);
												a.click();
											}}
											className="hover:text-background h-6 w-6 text-gray-400"
										>
											<LinkIcon className="max-h-3.5" />
										</Button>
										{item.status === "completed" && (
											<Button
												size="sm"
												variant="ghost"
												onClick={() =>
													openPath(
														join(item.categorized ? join(item.gamePath, item.category) : item.gamePath, item.name)
													)
												}
												className="hover:text-background h-6 w-6 text-gray-400"
											>
												<FolderIcon className="max-h-3.5" />
											</Button>
										)}
									</div>
									<div className="flex gap-1 text-xs text-gray-400 capitalize">
										{`${item.status + (item.status === "extracting" ? ` ${item.fname}` : "")}`}
										{item.status == "downloading" ? (
											<div
												ref={(ele) => {
													if (!elementRefs.current[item.key]) {
														elementRefs.current[item.key] = { background: null, text: null };
													}
													elementRefs.current[item.key].text = ele;
												}}
											>
												{prev[item.key]?.text || " • "}
											</div>
										) : (
											" • "
										)}
										{item.category}
									</div>
								</div>
							</div>
							<div className="z-20 flex items-center gap-2 text-sm">
								<div className="flex flex-col items-center justify-center w-12 text-xs">
									<img src={GAME_ICONS[item.game as Games] || GAME_ICONS[""]} className="w-6 h-6 rounded" />
									{GAME_NAMES[item.game as Games] || "Unknown Game"}{" "}
								</div>
								{item.status === "pending" ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => cancelDownload(item.key, "queue")}
										className="hover:text-destructive"
									>
										<XIcon className="w-4 h-4" />
									</Button>
								) : item.status === "completed" ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => cancelDownload(item.key, "completed")}
										className="hover:text-background text-gray-400 h-6 w-6"
									>
										<XIcon className="w-4 h-4" />
									</Button>
								) : item.status === "downloading" ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => cancelDownload(item.key, "downloading")}
										className="hover:text-destructive h-6 w-6"
									>
										<SquareIcon fill="currentColor" className="w-4 h-4" />
									</Button>
								) : item.status === "extracting" ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => cancelDownload(item.key, "extracting")}
										className="hover:text-destructive h-6 w-6"
									>
										<SquareIcon fill="currentColor" className="w-4 h-4" />
									</Button>
								) : item.status === "failed" ? (
									<>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => retryMod(item.key)}
											className="hover:text-background text-gray-400 h-6 w-6"
										>
											<RefreshCcwIcon className="w-4 h-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => cancelDownload(item.key, "failed")}
											className="hover:text-background text-gray-400 h-6 w-6"
										>
											<XIcon className="w-4 h-4" />
										</Button>
									</>
								) : (
									<></>
								)}
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="border-border/30 bg-background/10 text-muted-foreground flex items-center justify-center w-full h-full border rounded-lg">
					No active downloads
				</div>
			)}
		</div>
	);
}
