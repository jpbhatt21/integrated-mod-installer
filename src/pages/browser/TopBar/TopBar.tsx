import { DownloadIcon, EyeIcon, SearchIcon, ThumbsUpIcon } from "lucide-react";
import CRD from "../CRD";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { BROWSE_PATH, BROWSE_RIGHT_SLIDE_OVER_OPEN, BROWSE_SORT, BROWSE_TYPE } from "@/utils/vars";
import { useAtom } from "jotai";
import { handleInAppLink } from "@/utils/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useText } from "@/hooks/use-text";

function TopBar() {
	const t = useText();
	const [term, setTerm] = useState("");
	const [onlinePath, setOnlinePath] = useAtom(BROWSE_PATH);
	const [onlineType, setOnlineType] = useAtom(BROWSE_TYPE);
	const [onlineSort, setOnlineSort] = useAtom(BROWSE_SORT);
	const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(BROWSE_RIGHT_SLIDE_OVER_OPEN);
	const [popoverOpen, setPopoverOpen] = useState(false);
	useEffect(() => {
		const handler = setTimeout(() => {
			if (term?.startsWith("http")) {
				handleInAppLink(term);
				const searchInput = (document.getElementById("search-input") as HTMLInputElement) || null;
				if (searchInput) {
					searchInput.value = "";
					searchInput.blur();
				}
				setOnlinePath("home&_type=" + onlineType);
				return;
			}

			if (term.trim() === "") {
				setOnlinePath("home&_type=" + onlineType);
			} else {
				setOnlinePath(`search/${term}&_type=${onlineType}`);
			}
		}, 250);
		return () => {
			clearTimeout(handler);
		};
	}, [term]);
	useEffect(() => {
		let searchInput = (document.getElementById("search-input") as HTMLInputElement) || null;
		if (searchInput) {
			searchInput.value = onlinePath.startsWith("search/") ? onlinePath.split("search/")[1].split("&_type=")[0] : "";
		}
	}, []);
	useEffect(() => {
		let searchInput = null as HTMLInputElement | null;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.keyCode == 116) window.location.reload(); // F5
			if (event.keyCode == 121) event.preventDefault();
			if (event.keyCode > 111 && event.keyCode < 124) return; // F1-F12
			if (!searchInput) searchInput = (document.getElementById("search-input") as HTMLInputElement) || null;
			if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
				let activeEl = document.activeElement;
				if (activeEl?.tagName === "BUTTON") activeEl = null;
				if (activeEl === document.body || activeEl === null) searchInput.focus();
				else if (event.code === "Escape" && activeEl === searchInput) {
					searchInput.value = "";
					searchInput.blur();
					setOnlinePath("home&_type=" + onlineType);
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);
	return (
		<CRD
			className="w-full h-16 flex items-center justify-between px-2 gap-2"
			style={{
				filter: rightSlideOverOpen ? "blur(calc(var(--blur-xs))) brightness(0.8)" : "",
			}}
			onClick={(e) => {
				if (rightSlideOverOpen) {
					e.preventDefault();
					e.stopPropagation();
					setRightSlideOverOpen(false);
				}
			}}
		>
			<div className="flex items-center justify-between w-full h-full px-3 py-1 overflow-hidden">
				<SearchIcon className="text-muted-foreground flex-shrink-0 w-4 h-4 mr-2" />
				<Input
					id="search-input"
					defaultValue={""}
					placeholder={t("search")}
					className="text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 h-8 bg-transparent border-0"
					onChange={(e) => {
						setTerm(e.target.value);
					}}
					onBlur={(e) => {
						setTerm(e.target.value);
					}}
				/>
			</div>
			<div className="min-w-32">
				<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
					<PopoverTrigger asChild>
						<div className="min-w-fit bg-accent text-background hover:brightness-150 cursor-pointerx flex items-center justify-center h-full gap-1 p-2 text-xs duration-300 rounded-md select-none">
							{onlinePath.startsWith("home") || onlinePath.startsWith("search")
								? onlineType == "Mod"
									? t("modsOnly")
									: t("all")
								: onlineSort == ""
									? t("default")
									: {
											Generic_MostLiked: (
												<>
													Most <ThumbsUpIcon className="h-4" />
												</>
											),
											Generic_MostViewed: (
												<>
													Most <EyeIcon className="h-4" />
												</>
											),
											Generic_MostDownloaded: (
												<>
													Most <DownloadIcon className="h-4" />
												</>
											),
										}[onlineSort]}
						</div>
					</PopoverTrigger>
					<PopoverContent className="game-font z-100 w-32 absolute backdrop-blur-md p-2 my-2 mr-2 -ml-16 bg-sidebar/20 rounded-lg">
						<div className="data-wuwa:gap-0 flex flex-col gap-2" onClick={() => setPopoverOpen(false)}>
							{onlinePath.startsWith("home") || onlinePath.startsWith("search") ? (
								<>
									<div
										className="hover:bg-accent hover:text-background bg-accent/10 min-h-8 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 rounded-md select-none"
										onClick={() => {
											setOnlineType("");
											setOnlinePath((prev) => `${prev.split("&_type=")[0]}&_type=`);
											// setSettings((prev) => ({ ...prev, onlineType: "" }));
											// saveConfig();
										}}
										style={{
											background: onlineType ? "" : "color-mix(in oklab, var(--accent) 50%, transparent)",
											color: onlineType ? "" : "var(--background)",
										}}
									>
										{t("all")}
									</div>
									<div
										className="hover:bg-accent hover:text-background bg-accent/10 min-h-8 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 rounded-md select-none"
										onClick={() => {
											setOnlineType("Mod");
											setOnlinePath((prev) => `${prev.split("&_type=")[0]}&_type=Mod`);
											// setSettings((prev) => ({ ...prev, onlineType: "Mod" }));
											// saveConfig();
										}}
										style={{
											background: onlineType ? "color-mix(in oklab, var(--accent) 50%, transparent)" : "",
											color: onlineType ? "var(--background)" : "",
										}}
									>
										{t("modsOnly")}
									</div>
								</>
							) : (
								<>
									{[
										{
											sort: "",
											children: <>{t("default")}</>,
											key: "",
										},
										{
											sort: "Generic_MostLiked",
											children: (
												<>
													Most <ThumbsUpIcon className="h-4" />
												</>
											),
											key: "most_liked",
										},
                                        {
                                            sort: "Generic_MostViewed",
                                            children: (
                                                <>
                                                    Most <EyeIcon className="h-4" />
                                                </>
                                            ),
                                            key: "most_viewed",
                                        },
                                        {
                                            sort: "Generic_MostDownloaded",
                                            children: (
                                                <>
                                                    Most <DownloadIcon className="h-4" />
                                                </>
                                            ),
                                            key: "most_downloaded",
                                        },
									]
                                    .map((item) => (
                                        <div
                                            key={item.key}
                                            className="hover:bg-accent hover:text-background bg-accent/10 min-h-8 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 rounded-md select-none"
                                            onClick={() => {
                                                setOnlineSort(item.sort);
                                                setOnlinePath((prev) => `${prev.split("&_sort=")[0]}&_sort=${item.key}`);
                                            }}
                                            style={{
                                                background: onlineSort == item.sort ? "color-mix(in oklab, var(--accent) 50%, transparent)" : "",
                                                color: onlineSort == item.sort ? "var(--background)" : "",
                                            }}
                                        >
                                            {item.children}
                                        </div>
                                    ))}
									
								</>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</CRD>
	);
}

export default TopBar;
