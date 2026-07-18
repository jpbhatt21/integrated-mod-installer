import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiClient } from "@/utils/api";
import { Games } from "@/utils/types";
import {
	fetchModwithUpdates,
	formatSize,
	getImageUrl,
	getTimeDifference,
	handleImageError,
	sanitizeFileName,
} from "@/utils/utils";
import { BROWSE_DATA, BROWSE_RIGHT_SLIDE_OVER_OPEN, BROWSE_SELECTED, BROWSE_SETTINGS } from "@/utils/vars";
import { useAtom, useAtomValue } from "jotai";
import {
	AngryIcon,
	ChevronDownIcon,
	DiscIcon,
	DownloadIcon,
	EllipsisIcon,
	EllipsisVerticalIcon,
	EyeIcon,
	HeartIcon,
	HelpingHandIcon,
	InfoIcon,
	LaughIcon,
	LinkIcon,
	LoaderIcon,
	MedalIcon,
	MessageSquareIcon,
	PinIcon,
	PlusIcon,
	Redo2Icon,
	StampIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	Trash2Icon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addToast } from "@/_Toaster/ToastProvider";
import Carousel from "./components/Carousel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { findTargets } from "@/utils/filesys";
import { useText } from "@/hooks/use-text";

const SAFE_HTML_CONFIG = {
	ALLOWED_TAGS: [
		"a",
		"b",
		"blockquote",
		"br",
		"code",
		"del",
		"div",
		"em",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"hr",
		"i",
		"img",
		"li",
		"ol",
		"p",
		"pre",
		"s",
		"span",
		"strong",
		"sub",
		"sup",
		"table",
		"tbody",
		"td",
		"th",
		"thead",
		"tr",
		"u",
		"ul",
	],
	ALLOWED_ATTR: ["alt", "class", "height", "href", "rel", "src", "target", "title", "width"],
	ALLOW_DATA_ATTR: false,
} as const;

export function sanitizeRemoteHtml(html: string | null | undefined): string {
	if (!html) return "";
	return DOMPurify.sanitize(html, {
		...SAFE_HTML_CONFIG,
		ALLOWED_TAGS: [...SAFE_HTML_CONFIG.ALLOWED_TAGS],
		ALLOWED_ATTR: [...SAFE_HTML_CONFIG.ALLOWED_ATTR],
	});
}

let now = Date.now() / 1000;
const typeToBg = {
	positive: "bg-success",
	negative: "bg-destructive",
	neutral: "bg-accent",
} as any;
function StampIcons({ title, className }: any) {
	let icon = <></>;
	switch (title) {
		case "Helpful":
			icon = <HelpingHandIcon className={className} />;
			break;
		case "Funny":
			icon = <LaughIcon className={className} />;
			break;
		case "Agree":
			icon = <ThumbsUpIcon className={className} />;
			break;
		case "Win":
			icon = <MedalIcon className={className} />;
			break;
		case "Intresting":
			icon = <PinIcon className={className} />;
			break;
		case "Thanks":
			icon = <HeartIcon className={className} />;
			break;
		case "Disagree":
			icon = <ThumbsDownIcon className={className} />;
			break;
		case "Rude":
			icon = <AngryIcon className={className} />;
			break;
		case "Toxic":
			icon = <Trash2Icon className={className} />;
			break;
		default:
			icon = <StampIcon className={className} />;
	}
	return icon;
}
const InstalledCache = {
	WW: {} as { [key: string]: Record<string, string>[] },
	ZZ: {} as { [key: string]: Record<string, string>[] },
	GI: {} as { [key: string]: Record<string, string>[] },
	SR: {} as { [key: string]: Record<string, string>[] },
	EF: {} as { [key: string]: Record<string, string>[] },
	"": {} as { [key: string]: Record<string, string>[] },
};
function RightSlideOver({ addToDownloads }: { addToDownloads: (url: string, item: any, mode?: string) => void }) {
	const t = useText();
	const selected = useAtomValue(BROWSE_SELECTED);
	const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(BROWSE_RIGHT_SLIDE_OVER_OPEN);
	const game = useAtomValue(BROWSE_SETTINGS).game as Games;
	const [onlineData, setOnlineData] = useAtom(BROWSE_DATA);
	const [aboutOpen, setAboutOpen] = useState(false);
	const [updateOpen, setUpdateOpen] = useState(false);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [popover2Open, setPopover2Open] = useState(false);
	const popover2Ref = useRef<number | null>(null);
	const [loadingComments, setLoadingComments] = useState(false);
	const [lastSelected, setLastSelected] = useState("about");
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [altPopoverOpen, setAltPopoverOpen] = useState(false);
	const [installedItemPopoverOpen, setInstalledItemPopoverOpen] = useState(false);
	const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
	const [_, setLinkExistingPopoverOpen] = useState(false);
	const item = onlineData[game][selected as any] as any;
	const [installedItems, setInstalledItems] = useState<Record<string, string>[]>([]);
	const [installedItem, setInstalledItem] = useState<number>(-1);
	const type = installedItems.length ? t("Reinstall") : t("Install");
	useEffect(() => {
		now = Date.now() / 1000;
		const controller = new AbortController();
		if (selected) {
			setInstalledItems([]);
			setInstalledItem(-1);
			setRightSlideOverOpen(true);
			setLoadingComments(false);
			setAboutOpen(true);
			setLastSelected("about");
			setCommentsOpen(false);
			setUpdateOpen(false);
			setPopoverOpen(false);
			setAltPopoverOpen(false);
			fetchModwithUpdates(game, selected, controller);
			if (InstalledCache[game][selected]) {
				setInstalledItems(InstalledCache[game][selected]);
			}
			findTargets(selected.replace("Mod", "mods"), game).then((targets) => {
				InstalledCache[game][selected] = targets;
				setInstalledItems(targets);
			});
		} else {
			setRightSlideOverOpen(false);
		}
		return () => {
			controller.abort();
		};
	}, [selected, game]);
	const getComments = useCallback(
		async (signal: AbortSignal) => {
			try {
				if (selected && onlineData[game][selected]) {
					const item = onlineData[game][selected] as any;
					item._aComments = item._aComments || {
						total: 0,
						count: 0,
						data: {},
						list: [],
					};
					const data = await apiClient.comments(selected, Math.floor(item._aComments.count / 15) + 1, signal);
					if (!data || signal.aborted) return;
					data._aRecords = (data._aRecords || []).filter((comment: any) => comment._aPoster);
					item._aComments = {
						...item._aComments,
						total: data._aMetadata._nRecordCount,
						count: data._aMetadata._bIsComplete
							? data._aMetadata._nRecordCount
							: item._aComments.count + data._aMetadata._nPerpage,
						data: {
							...item._aComments.data,
							...Object.fromEntries(
								data._aRecords.map((comment: any) => [
									comment._idRow,
									{
										...comment,
										_aLabels: new Set(comment._aLabels || []),
										_aStamps: comment._aStamps?.sort((a: any, b: any) => b._nCount - a._nCount) || [],
									},
								])
							),
						},
						list: [...item._aComments.list, ...data._aRecords.map((comment: any) => comment._idRow)],
					};
					setOnlineData((prev) => ({
						...prev,
						[game]: { ...prev[game], [selected]: { ...prev[game][selected], _aComments: item._aComments } },
					}));
				}
			} catch (e) {
				console.error("Error fetching comments:", e);
			}
			setLoadingComments(false);
		},
		[selected, onlineData]
	);
	useEffect(() => {
		if (loadingComments && selected) {
			const controller = new AbortController();
			getComments(controller.signal);
			return () => {
				controller.abort();
			};
		}
		return () => {};
	}, [selected, loadingComments]);
	const popoverContent = item?._aFiles?.map((file: any) => (
		<Button
			className="min-h-fit data-wuwa:p-2 flex items-center justify-center min-w-full gap-1 p-4 overflow-hidden"
			style={{
				borderRadius: "0.25rem",
			}}
			onClick={() => {
				// addToDownloadQueue(file);
				const tgt =
					installedItem != -1 ? installedItems[installedItem] : installedItems.length > 0 ? installedItems[0] : null;
				addToDownloads(
					file._sDownloadUrl,
					{
						game,
						gamePath: "",
						key: Date.now().toString() + game + item._idRow + file._idRow,
						status: "pending",
						preview:
							item._aPreviewMedia && item._aPreviewMedia._aImages && item._aPreviewMedia._aImages.length > 0
								? item._aPreviewMedia._aImages[0]._sBaseUrl + "/" + item._aPreviewMedia._aImages[0]._sFile
								: "",
						category: sanitizeFileName(tgt?.category || item._aCategory._sName || ""),
						source: item._sProfileUrl || "",
						file: file._sDownloadUrl,
						fname: file._sFile,
						name: sanitizeFileName(tgt?.name || item._sName),
					},
					altPopoverOpen ? "rename" : "overwrite"
				);
				setPopoverOpen(false);
				setAltPopoverOpen(false);
			}}
		>
			<div className="w-[calc(100%-6rem)] text-start flex flex-col gap-1">
				<p className=" text-ellipsis wrap-break-word overflow-hidden text-base resize-none">{file._sFile}</p>
				<div className=" min-w-fit text-background flex flex-wrap w-full gap-1 text-xs">
					{file._aAnalysisWarnings?.contains_exe ? (
						<div className=" bg-destructive item flex justify-center w-12 px-1 text-center rounded-lg">Exe</div>
					) : (
						""
					)}
					{file._sAnalysisState == "done" ? (
						<>
							{file._sAvState == "done" && file._sAvResult == "clean" ? (
								<div className=" bg-success w-16 px-1 text-center rounded-lg">
									{t("Clean")}
								</div>
							) : (
								<div className=" bg-destructive w-16 px-1 text-center rounded-lg">
									{t("Danger")}
								</div>
							)}
						</>
					) : (
						<div className=" bg-warn w-12 px-1 text-center rounded-lg">
							{t("Pending")}
						</div>
					)}
				</div>
				<div className="flex items-center gap-1">
					{file._sDescription && file._sDescription.length > 0 && (
						<Tooltip>
							<TooltipTrigger className="flex items-center gap-1">
								<InfoIcon />
								<p className="w-52 text-ellipsis brightness-75 wrap-break-word overflow-hidden text-xs resize-none">
									{file._sDescription}
								</p>
							</TooltipTrigger>
							<TooltipContent className="max-w-64 -mb-5 w-fit text-center" hideArrow>
								<p className="max-w-64 text-background text-center break-words">{file._sDescription}</p>
							</TooltipContent>
						</Tooltip>
					)}
				</div>
			</div>
			<div className="min-w-24 flex flex-col items-center">
				<div className="flex gap-1">
					{" "}
					<LoaderIcon />
					{getTimeDifference(now, file._tsDateAdded)}
				</div>
				<div className="flex gap-1">
					{" "}
					<DownloadIcon />
					{file._nDownloadCount}
				</div>
				<div className=" flex gap-1">
					{" "}
					<DiscIcon />
					{formatSize(file._nFilesize || 0)}
				</div>
			</div>
		</Button>
	));
	const viewReplies = useCallback(
		async (e: React.MouseEvent<HTMLButtonElement>, comment: any) => {
			e.currentTarget.disabled = true;
			try {
				const children = ((await apiClient.nestedcomments(comment._idRow))?._aRecords || []).filter(
					(comment: any) => comment._aPoster
				);
				setOnlineData((prev: any) => {
					return {
						...prev,
						[game]: {
							...prev[game],
							[selected]: {
								...prev[game][selected],
								_aComments: {
									...prev[game][selected]._aComments,
									data: {
										...prev[game][selected]._aComments.data,
										[comment._idRow]: {
											...prev[game][selected]._aComments.data[comment._idRow],
											children: children.map((c: any) => c._idRow),
										},
										...Object.fromEntries(
											children.map((c: any) => [
												c._idRow,
												{
													...c,
													_aLabels: new Set(c._aLabels || []),
													_aStamps: c._aStamps?.sort((a: any, b: any) => b._nCount - a._nCount) || [],
												},
											])
										),
									},
								},
							},
						},
					};
				});
			} catch (err) {
				console.error("Error fetching replies:", err);
				e.currentTarget.disabled = false;
			}
		},
		[selected, onlineData, game]
	);
	function recursiveComments(list: any[], depth = 0): any {
		return (
			<div className="flex flex-col w-full gap-4">
				{list.map((commentId: any, index: number) => {
					const comment = item?._aComments?.data?.[commentId];
					return (
						<>
							{index > 0 && <hr />}
							<div
								key={commentId}
								className="flex select-none flex-col bg-input/20 rounded gap-2"
								onDoubleClick={(e) => {
									let lastChild = e.currentTarget.lastElementChild as HTMLDivElement;
									if (lastChild) {
										if (lastChild.style.height == "0px") lastChild.style.height = "auto";
										else lastChild.style.height = "0px";
									}
								}}
							>
								<div
									className={`flex items-center rounded p-1 pt-2 pl-2 gap-2 ${comment._aLabels.has("Submitter") && "bg-accent/10"}`}
								>
									<img
										className="aspect-square outline bg-accent/10 flex items-center justify-center object-cover h-10 text-white rounded-full pointer-events-none"
										onError={handleImageError}
										src={comment._aPoster?._sAvatarUrl || "err"}
									/>
									<div className="flex shrink-0 flex-col">
										{comment._aPoster?._sUpicUrl ? (
											<img src={comment._aPoster?._sUpicUrl} className="max-h-4" alt="User Pic" />
										) : (
											<span className="text-accent select-text font-medium">{comment._aPoster?._sName}</span>
										)}
										<span className="text-[0.625rem] font-medium">{comment._aPoster?._sUserTitle}</span>
									</div>
									{comment._aLabels.has("Submitter") && (
										<span className="text-xs rounded px-1 bg-accent text-background">{t("submitter")}</span>
									)}
									<span className="text-xs text-gray-400">
										{getTimeDifference(now, comment._tsDateModified || comment._tsDateAdded || 0)}
									</span>
									{comment._iPinLevel > 0 && <PinIcon className="h-4 fill-accent stroke-accent" />}
									{comment._aPoster?._sSigUrl && (
										<img src={comment._aPoster?._sSigUrl} className="max-h-4" alt="User Pic" />
									)}
									<div className="flex w-full overflow-auto gap-1 thin">
										{comment._aStamps?.length > 4 ? (
											<>
												{comment._aStamps.slice(0, 3).map((stamp: any) => (
													<span
														className={`text-xs rounded py-0.5 px-1 ${typeToBg[stamp._sCategory]} flex items-center justify-center text-background`}
													>
														<div className="flex items-center justify-center flex-col text-[0.6rem]">
															<StampIcons className={" max-h-4 min-h-4"} title={stamp._sTitle} />
															<span>{stamp._nCount > 1 ? `x${stamp._nCount}` : ""}</span>
														</div>
														{stamp._sTitle}
													</span>
												))}
												<Tooltip>
													<TooltipTrigger>
														<span
															className={`text-xs rounded h-full px-1 py-0.5 ${typeToBg["neutral"]} flex items-center justify-center text-background`}
														>
															{/* <StampIcons className={" max-h-4"} title={stamp._sTitle} /> */}
															<EllipsisIcon className="min-h-4 max-h-4" />
															{/* {stamp._sTitle} {stamp._nCount > 1 ? `x${stamp._nCount}` : ""} */}+
															{comment._aStamps.length - 3} Stamps
														</span>
													</TooltipTrigger>
													<TooltipContent className="max-w-64 bg-accent/10 backdrop-blur-md py-4 w-fit text-center">
														<div className="flex flex-col gap-1">
															{comment._aStamps.slice(3).map((stamp: any) => (
																<span
																	className={`text-xs rounded px-1 py-0.5 ${typeToBg[stamp._sCategory]} flex items-center justify-center text-background`}
																>
																	<StampIcons className={" max-h-4"} title={stamp._sTitle} />
																	{stamp._sTitle} {stamp._nCount > 1 ? `x${stamp._nCount}` : ""}
																</span>
															))}
														</div>
													</TooltipContent>
												</Tooltip>
											</>
										) : (
											comment._aStamps?.map((stamp: any) => (
												<span
													className={`text-xs rounded px-1 py-0.5 ${typeToBg[stamp._sCategory]} flex items-center justify-center text-background`}
												>
													<div className="flex items-center justify-center flex-col text-[0.6rem]">
														<StampIcons className={" max-h-4 min-h-4"} title={stamp._sTitle} />
														<span>{stamp._nCount > 1 ? `x${stamp._nCount}` : ""}</span>
													</div>
													{stamp._sTitle}
												</span>
											))
										)}
									</div>
								</div>
								<div className="w-full flex flex-col gap-4 h-auto overflow-hidden pl-14 pb-3 pr-3">
									<div
										className="w-full select-text duration-200 font-sans "
										dangerouslySetInnerHTML={{ __html: sanitizeRemoteHtml(comment._sText) }}
									/>
									{comment.children?.length > 0 && recursiveComments(comment.children, depth + 1)}
									{comment._nReplyCount > 0 && !comment.children && (
										<Button
											variant="outline"
											size="sm"
											className="self-start"
											onClick={async (e) => {
												viewReplies(e, comment);
											}}
										>
											{/* {textData._RightSideBar._RightOnline.ViewReps} */}
											{t("ViewReps")} ({comment._nReplyCount})
										</Button>
									)}
								</div>
							</div>
						</>
					);
				})}
			</div>
		);
	}
	return (
		<AnimatePresence mode="wait">
			{rightSlideOverOpen && (
				<>
					<motion.div
						key="right-slide-over"
						initial={{ translateX: "100%", opacity: 0 }}
						animate={{ translateX: "0%", opacity: 1 }}
						exit={{ translateX: "100%", opacity: 0 }}
						transition={{ duration: 0.3, ease: "linear" }}
						className="max-w-[47vw] w-200 backdrop-blur-sm bg-button/50 bgpattern fixed top-8 right-0 z-10 flex flex-col items-center justify-center h-[calc(100vh-2rem)] overflow-hidden border-l"
					>
						<AnimatePresence mode="wait">
							{!selected ? (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2 }}
									key="no-selection"
									className="text-accent flex items-center justify-center h-full p-4"
								>
									{t("NoItem")}
								</motion.div>
							) : !onlineData[game][selected] ? (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2 }}
									key="loading"
									className="text-accent flex items-center justify-center h-full p-4"
								>
									<LoaderIcon className="animate-spin" />
								</motion.div>
							) : item && (item._bIsPrivate || item._bIsTrashed || item._bIsWithheld) ? (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2 }}
									key="loading"
									className="text-accent flex flex-col items-center justify-center h-full gap-4 p-4"
								>
									{
										{
											Private: t("Private"),
											Deleted: t("Deleted"),
											Withheld: t("Withheld"),
										}[item._bIsPrivate ? "Private" : item._bIsTrashed ? "Deleted" : "Withheld"]
									}
									{selected.startsWith("Mod") && (
										<a
											href={`https://gamebanana.com/${selected.replace("Mod", "mods")}`}
											target="_blank"
											className="text-xs"
										>
											{t("OpenBrowser")}
										</a>
									)}
								</motion.div>
							) : (
								<motion.div
									key={"loaded" + selected}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2 }}
									className="flex flex-col items-center w-full h-full overflow-hidden duration-300"
								>
									<div className="text-accent min-h-16 flex items-center justify-start w-full gap-3 px-3 border-b">
										<div className="min-w-fit trs bg-input/50 flex items-center gap-2 p-2 rounded-md">
											<img
												className="aspect-square min-w-6 max-w-6 scale-120 ctrs h-full rounded-full pointer-events-none"
												onError={(e) => {
													e.currentTarget.src = "/who.jpg";
												}}
												src={item._aCategory?._sIconUrl || "err"}
											/>

											<span className="ctrs">{item._aCategory?._sName.split(" ")[0]}</span>
										</div>

										<Label key={item._sName} className="w-full text-xl text-center">
											{item._sName}
										</Label>

										<Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
											<PopoverTrigger className="focus-within:outline-none bg-input/50 duration-200 rounded-md hover:bg-input">
												<div className="min-w-fit  aspect-square flex items-center gap-2 p-3">
													<LinkIcon className="h-4 w-4" />
												</div>
											</PopoverTrigger>
											<PopoverContent className="w-fit bg-sidebar/50 backdrop-blur-md flex flex-col p-2">
												<Button
													onClick={() => {
														navigator.clipboard.writeText(item._sProfileUrl || "");
														addToast({ type: "success", message: t("LinkCopied") });
														setLinkPopoverOpen(false);
														setLinkExistingPopoverOpen(false);
													}}
												>
													{t("CopyLink")}
												</Button>
												<Button
													className="w-full mt-2"
													onClick={() => {
														const a = document.createElement("a");
														a.href = item._sProfileUrl || "";
														a.target = "_blank";
														document.body.appendChild(a);
														a.click();
														document.body.removeChild(a);
														setLinkPopoverOpen(false);
														setLinkExistingPopoverOpen(false);
													}}
												>
													{t("OpenBrowser")}
												</Button>
											</PopoverContent>
										</Popover>
										<div className="min-w-fit trs bg-input/50 flex items-center gap-2 p-2 rounded-md">
											<img
												className="aspect-square min-w-6 max-w-6 scale-120 ctrs h-full rounded-full pointer-events-none"
												onError={(e) => {
													e.currentTarget.src = "/who.jpg";
												}}
												src={item._aSubmitter?._sAvatarUrl || "err"}
											/>

											<span className="ctrs">{item._aSubmitter?._sName}</span>
										</div>
									</div>

									<div
										id="container"
										className="flex flex-col w-full pb-2 mb-24 overflow-hidden overflow-y-scroll"
										onScroll={() => {
											if (popover2Ref.current) {
												clearTimeout(popover2Ref.current);
												popover2Ref.current = null;
											}
											setPopover2Open(true);
											popover2Ref.current = setTimeout(() => {
												setPopover2Open(false);
											}, 2000);
										}}
									>
										<div
											key={item._sName + "pix"}
											className="min-h-fit flex flex-col items-center w-full max-h-full gap-1 px-2 mt-2 mb-3 overflow-hidden pointer-events-none"
										>
											{item._aPreviewMedia &&
												item._aPreviewMedia._aImages &&
												item._aPreviewMedia._aImages.length > 0 && <Carousel data={item._aPreviewMedia._aImages} />}
										</div>
										{item._sText && (
											<Collapsible
												key={item._sName + "abt"}
												id="about"
												className="w-full px-2 pb-3"
												open={aboutOpen}
												onOpenChange={(open) => {
													setAboutOpen(open);
													if (open) setLastSelected("about");
												}}
											>
												<CollapsibleTrigger className="text-accent flex items-center justify-between w-full h-8">
													<Button
														className={
															"w-full flex justify-between bg-accent bgaccent   text-background " +
															(aboutOpen
																? "hover:brightness-125"
																: "bg-input/50 text-accent hover:text-accent hover:bg-input")
														}
													>
														{t("About")}{" "}
														<ChevronDownIcon
															id="deschev"
															className=" transform-[roate(180deg)] duration-200"
															style={{ transform: aboutOpen ? "rotate(180deg)" : "rotate(0deg)" }}
														/>
													</Button>
												</CollapsibleTrigger>
												<CollapsibleContent className="border-accent w-full pt-2 pl-2 mt-2">
													<div
														className="w-full font-sans"
														dangerouslySetInnerHTML={{ __html: sanitizeRemoteHtml(item._sText) }}
													></div>
												</CollapsibleContent>
											</Collapsible>
										)}
										{item._eUpdate && (
											<Collapsible
												key={item._sName + "upd"}
												id="updates"
												className=" w-full px-2 pb-3"
												open={updateOpen}
												onOpenChange={(open) => {
													setUpdateOpen(open);
													if (open) setLastSelected("update");
												}}
											>
												<CollapsibleTrigger className="text-accent flex items-center justify-between w-full h-8">
													<Button
														className={
															"w-full flex justify-between bg-accent bgaccent   text-background " +
															(updateOpen
																? "hover:brightness-125"
																: "bg-input/50 text-accent hover:text-accent hover:bg-input")
														}
													>
														{t("Updates")}{" "}
														<ChevronDownIcon
															id="deschev"
															className=" transform-[roate(180deg)] duration-200"
															style={{ transform: updateOpen ? "rotate(180deg)" : "rotate(0deg)" }}
														/>
													</Button>
												</CollapsibleTrigger>
												<CollapsibleContent className="border-accent flex flex-col w-full gap-4  pt-2 mt-2">
													{item._aUpdates &&
														item._aUpdates.length > 0 &&
														item._aUpdates.map((itm: any, index: number) => (
															<>
																{index > 0 && <hr className="border-accent/50" />}

																<div className="flex rounded flex-col gap-2 bg-input/10 p-2">
																	<div className="text-accent flex items-center justify-between pb-4 border-b">
																		{itm._sName}
																		<label className="flex flex-col text-xs text-gray-300">
																			{" "}
																			<label>{itm._sVersion}</label>{" "}
																			<label className=" text-cyan-200">
																				{getTimeDifference(now, itm._sDate || 0)}
																			</label>
																		</label>
																	</div>
																	<div className=" flex flex-col gap-2">
																		{itm._aChangeLog &&
																			itm._aChangeLog.map((changeItem: any, index: number) => (
																				<div key={index} className="flex items-center gap-2">
																					<div className="min-w-2 min-h-2 self-start mt-1.75 bg-accent bgaccent   rounded-full" />
																					<label className=" text-cyan-50 font-sans text-sm">
																						{changeItem.text}- [{changeItem.cat}]
																					</label>
																				</div>
																			))}
																	</div>
																	{itm._sText && (
																		<div
																			className="w-full font-sans"
																			dangerouslySetInnerHTML={{ __html: sanitizeRemoteHtml(itm._sText) }}
																		/>
																	)}
																</div>
															</>
														))}
												</CollapsibleContent>
											</Collapsible>
										)}
										<Collapsible
											key={item._sName + "cmt"}
											id="comments"
											className="w-full px-2 pb-1"
											open={commentsOpen}
											onOpenChange={(open) => {
												setCommentsOpen(open);
												setLastSelected("comments");
												if (open && (!item._aComments || item._aComments.length == 0)) {
													setLoadingComments(true);
												}
											}}
										>
											<CollapsibleTrigger className="text-accent flex items-center justify-between w-full h-8">
												<Button
													className={
														"w-full flex justify-between bg-accent bgaccent   text-background " +
														(commentsOpen
															? "hover:brightness-125"
															: "bg-input/50 text-accent hover:text-accent hover:bg-input")
													}
												>
													{t("Comments")}{" "}
													<ChevronDownIcon
														id="deschev"
														className=" transform-[roate(180deg)] duration-200"
														style={{ transform: commentsOpen ? "rotate(180deg)" : "rotate(0deg)" }}
													/>
												</Button>
											</CollapsibleTrigger>
											<CollapsibleContent className="border-accent w-full pt-2 mt-2">
												{item._aComments && item._aComments.total > 0
													? recursiveComments(item._aComments.list, 0)
													: !loadingComments && (
															<div className="flex items-center justify-center w-full p-4 text-accent">
																{t("NoComs")}
															</div>
														)}
												{loadingComments ? (
													<div className="flex items-center justify-center w-full p-4">
														<LoaderIcon className="animate-spin" />
													</div>
												) : (
													item._aComments &&
													item._aComments.count < item._aComments.total && (
														<Button
															className="w-full mt-2"
															onClick={() => {
																setLoadingComments(true);
															}}
														>
															{t("LoadMore")}
														</Button>
													)
												)}
											</CollapsibleContent>
										</Collapsible>
									</div>
									<div className="text-accent min-h-24 justify-evenly absolute bottom-0 flex items-center h-24 min-w-full gap-1 px-1 border-t">
										<div className="min-w-40 grid w-40 grid-cols-3 gap-2 text-xs">
											{[
												<>
													<PlusIcon className="min-h-4 h-4" />
													{getTimeDifference(now, item._tsDateAdded || 0)}
												</>,
												<>
													<LoaderIcon className="h-4" />
													{getTimeDifference(now, item._tsDateModified || 0)}
												</>,
												<>
													<ThumbsUpIcon className="h-4" />
													{item._nLikeCount || "0"}
												</>,

												<>
													<MessageSquareIcon className="h-4" />
													{item._nPostCount || "0"}
												</>,
												<>
													<DownloadIcon className="h-4" />
													{item._nDownloadCount || "0"}
												</>,
												<>
													<EyeIcon className="h-4" />
													{item._nViewCount || "0"}
												</>,
											].map((children) => (
												<label className="zzz-fg-text text-accent flex flex-col items-center justify-center">
													{children}
												</label>
											))}
										</div>
										<Separator className="max-w-0 min-h-full border-l" />
										<div className="min-w-fit flex flex-col items-center justify-center gap-1">
											<div className="min-w-fit flex items-center justify-center w-full gap-1">
												<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
													<PopoverTrigger
														style={{ width: `${type == "Install" ? "19.5rem" : "16.5rem"}` }}
														className="flex bg-input/50 hover:bg-input h-10 gap-4 overflow-hidden text-ellipsis zzz-fg-text button-like text-accent shadow-xs hover:brightness-120  duration-300  items-center justify-center active:scale-90 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0.1875rem] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
														disabled={!item._aFiles || item._aFiles?.length == 0}
													>
														{type == "Install" ? <DownloadIcon /> : <Redo2Icon />}
														{type}
													</PopoverTrigger>
													<PopoverContent
														className="w-152 max-w-[calc(42vw-8.625rem)] mr-1 max-h-[75vh] overflow-auto gap-1 bg-sidebar/50 backdrop-blur-md p-1 flex flex-col"
														style={{ marginLeft: true ? "0rem" : "3rem", marginBottom: "0.5rem" }}
													>
														{popoverContent}
													</PopoverContent>
												</Popover>

												{type !== "Install" && (
													<Popover open={altPopoverOpen} onOpenChange={setAltPopoverOpen}>
														<PopoverTrigger
															className="w-10 bg-input/50 hover:bg-input flex h-10 gap-4 overflow-hidden text-ellipsis button-like zzz-fg-text text-accent shadow-xs hover:brightness-120  duration-300  items-center justify-center active:scale-90 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0.1875rem] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
															disabled={!item._aFiles || item._aFiles?.length == 0}
														>
															<EllipsisVerticalIcon />
														</PopoverTrigger>
														<PopoverContent className="w-152 max-w-[calc(42vw-8.625rem)] mr-2 max-h-[75vh] mb-2 overflow-auto gap-1 bg-sidebar/50 backdrop-blur-md p-1 flex flex-col">
															<Label className="bg-accent/25 data-zzz:bg-zzz-accent-2/25 data-zzz:text-zzz-accent-2 text-accent flex items-center justify-center w-full h-12 text-lg rounded-md">
																{t("Sep")}
															</Label>
															{popoverContent}
														</PopoverContent>
													</Popover>
												)}
											</div>
											{installedItems.length > 1 && (
												<Popover open={installedItemPopoverOpen} onOpenChange={setInstalledItemPopoverOpen}>
													<PopoverTrigger
														className="flex w-full h-10 gap-2 overflow-hidden text-ellipsis bg-input/50 hover:bg-input zzz-fg-text button-like text-accent shadow-xs hover:brightness-120  duration-300  items-center justify-center active:scale-90 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0.1875rem] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
														disabled={!item._aFiles || item._aFiles?.length == 0}
													>
														{installedItem != -1 ? (
															<>
																<img
																	className="w-12 outline bg-accent/10 flex items-center justify-center object-cover h-8 text-white rounded-full pointer-events-none"
																	onError={(e) => {
																		e.currentTarget.src = "/who.jpg";
																	}}
																	src={getImageUrl(installedItems[installedItem].path) || "err"}
																/>

																<div className="text-ellipsis whitespace-nowrap max-w-60 text-start w-full overflow-hidden break-words">
																	{installedItems[installedItem].name}
																</div>
															</>
														) : (
															<>{t("selectModUpd")}</>
														)}
													</PopoverTrigger>
													<PopoverContent
														className="w-152 max-w-[calc(42vw-8.625rem)] mr-1 max-h-[75vh] overflow-auto gap-1 bg-sidebar/50 backdrop-blur-md p-1 flex flex-col"
														style={{ marginLeft: "0.25rem", marginBottom: "0.5rem" }}
													>
														{installedItems.map((mod, index) => (
															<Button
																className="min-h-fit data-wuwa:p-2 flex min-w-full gap-1 p-1 overflow-hidden"
																style={{
																	borderRadius: "0.25rem",
																}}
																onClick={() => {
																	setInstalledItem(index);
																	setInstalledItemPopoverOpen(false);
																}}
															>
																<img
																	className="w-20 outline shrink-0 bg-accent/10 flex items-center justify-center object-cover h-12 text-white rounded-sm pointer-events-none"
																	onError={(e) => {
																		e.currentTarget.src = "/who.jpg";
																	}}
																	src={getImageUrl(mod.path) || "err"}
																/>

																<div className="w-full flex flex-col">
																	<div className=" max-h-full text-base text-start w-full text-wrap wrap-break-word">
																		{mod.name}
																	</div>
																	<div className=" max-h-full text-xs text-muted text-start w-full text-wrap wrap-break-word">
																		{mod.path.split("\\").slice(0, -1).join("\\")}
																	</div>
																</div>
															</Button>
														))}
													</PopoverContent>
												</Popover>
											)}
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
					<motion.div
						className="max-w-[47vw] w-200 flex items-center justify-center pointer-events-none fixed right-0 bottom-25 z-10"
						initial={{ translateX: "100%", opacity: 0 }}
						animate={{ translateX: "0%", opacity: 1 }}
						exit={{ translateX: "100%", opacity: 0 }}
						transition={{ duration: 0.3, ease: "linear" }}
					>
						<div
							className="flex min-h-14 w-fit self-center items-center pointer-events-auto justify-center gap-2 bg-sidebar/50 rounded border button-like backdrop-blur-md p-2 mr-2 transition-opacity mt-2 z-10 duration-200"
							style={{
								opacity: item?._sText || item?._eUpdate ? (popover2Open ? 1 : 0) : 0,
							}}
							onMouseEnter={() => {
								if (popover2Ref.current) {
									clearTimeout(popover2Ref.current);
									popover2Ref.current = null;
								}
								setPopover2Open(true);
							}}
							onMouseLeave={() => {
								if (popover2Ref.current) {
									clearTimeout(popover2Ref.current);
									popover2Ref.current = null;
								}
								popover2Ref.current = setTimeout(() => {
									setPopover2Open(false);
								}, 1000);
							}}
						>
							{item?._sText && (
								<Button
									className={
										"w flex justify-between bg-accent text-background " +
										(lastSelected == "about"
											? "hover:brightness-125"
											: "bg-input/50 text-accent hover:text-accent hover:bg-input")
									}
									onClick={() => {
										setAboutOpen(true);
										setLastSelected("about");
										setTimeout(() => {
											const container = document.getElementById("container");
											const about = document.getElementById("about");
											if (about && container) {
												container.scrollTo({
													top: about.offsetTop - container.offsetTop - 10,
													behavior: "smooth",
												});
											}
										}, 50);
									}}
								>
									{t("About")}
								</Button>
							)}
							{item?._eUpdate && (
								<Button
									className={
										"w flex justify-between bg-accent text-background " +
										(lastSelected == "update"
											? "hover:brightness-125"
											: "bg-input/50 text-accent hover:text-accent hover:bg-input")
									}
									onClick={() => {
										setUpdateOpen(true);
										setLastSelected("update");
										setTimeout(() => {
											const container = document.getElementById("container");
											const updates = document.getElementById("updates");
											if (updates && container) {
												container.scrollTo({
													top: updates.offsetTop - container.offsetTop - 10,
													behavior: "smooth",
												});
											}
										}, 50);
									}}
								>
									{t("Updates")}
								</Button>
							)}
							{item && (
								<Button
									className={
										"w flex justify-between bg-accent text-background " +
										(lastSelected == "comments"
											? "hover:brightness-125"
											: "bg-input/50 text-accent hover:text-accent hover:bg-input")
									}
									onClick={() => {
										setCommentsOpen((prev) => {
											if (!prev && (!item._aComments || item._aComments.length == 0)) {
												setLoadingComments(true);
											}
											return true;
										});

										setLastSelected("comments");
										setTimeout(() => {
											const container = document.getElementById("container");
											const comments = document.getElementById("comments");
											if (comments && container) {
												container.scrollTo({
													top: comments.offsetTop - container.offsetTop - 10,
													behavior: "smooth",
												});
											}
										}, 50);
									}}
								>
									{t("Comments")}
								</Button>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

export default RightSlideOver;
