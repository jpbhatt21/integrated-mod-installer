import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CRD from "../CRD";
import { useAtom, useAtomValue } from "jotai";
import {
	BROWSE_DATA,
	BROWSE_PATH,
	BROWSE_RIGHT_SLIDE_OVER_OPEN,
	BROWSE_SELECTED,
	BROWSE_SETTINGS,
	BROWSE_SORT,
	BROWSE_TYPE,
} from "@/utils/vars";
import { TYPES } from "@/utils/consts";
import { OnlineMod } from "@/utils/types";
import { apiClient } from "@/utils/api";
import { AnimatePresence, motion } from "motion/react";
import { preventContextMenu } from "@/utils/utils";
import { LoaderIcon } from "lucide-react";
import Carousel from "./components/Carousel";
import CardOnline from "./components/CardOnline";
type gms = "WW" | "ZZ" | "GI" | "SR" | "EF";
const pageCount: Record<gms, Record<string, number>> = {
	WW: {},
	ZZ: {},
	GI: {},
	SR: {},
	EF: {},
};
function Main() {
	const [initial, setInitial] = useState(true);
	const loadingRef = useRef(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const carouselRef = useRef<HTMLDivElement | null>(null);
	const maxRef = useRef(0);
	const prevLoadedRef = useRef(0);
	const [loadError, setLoadError] = useState("");
	const nsfw = useAtomValue(BROWSE_SETTINGS).nsfw;
	const game = useAtomValue(BROWSE_SETTINGS).game as gms;
	const [onlineData, setOnlineData] = useAtom(BROWSE_DATA);
	const onlineType = useAtomValue(BROWSE_TYPE);
	const onlinePath = useAtomValue(BROWSE_PATH);
	const onlineSort = useAtomValue(BROWSE_SORT);
	const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(BROWSE_RIGHT_SLIDE_OVER_OPEN);
	const [_, setSelected] = useAtom(BROWSE_SELECTED);
	const types = TYPES[game as keyof typeof TYPES];
	const [visibleRange, setVisibleRange] = useState({ start: -1, end: -1 });
	useEffect(() => {
		(setInitial(true), setLoadError(""), setSelected(""), setVisibleRange({ start: -1, end: -1 }));
	}, [game]);
	const onModClick = useCallback(
		(e: React.MouseEvent<HTMLElement>, mod: OnlineMod) => {
			let targetTag = (e.target as HTMLElement).tagName.toLowerCase();
			if (targetTag !== "button") {
				setSelected(mod ? `${mod._sModelName}/${mod._idRow}` : "");
				setRightSlideOverOpen(true);
			}
		},
		[setSelected]
	);
	const nextPage = useCallback(
		async (url: string, onlinePath: string) => {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Request failed with ${res.status}`);
			const data = await res.json();
			setOnlineData((prev) => {
				return {
					...prev,
					[game]: {
						...prev[game],
						[onlinePath as string]: [
							...((prev[game][onlinePath as string] || []) as OnlineMod[]),
							...(data._aRecords as OnlineMod[]),
						],
					},
				};
			});
			loadingRef.current = false;
		},
		[game, onlinePath]
	);
	const checkLoadMore = useCallback(async () => {
		if (!containerRef.current || loadingRef.current) return;

		const container = containerRef.current;
		const { scrollTop, scrollHeight, clientHeight } = container;

		// Check if we're near the bottom (within 100px)
		if (scrollHeight - scrollTop - clientHeight < 100) {
			loadingRef.current = true;
			pageCount[game][onlinePath] =
				pageCount[game][onlinePath] ||
				Math.max(1, Math.ceil((((onlineData[game][onlinePath] as OnlineMod[]) || []).length || 15) / 15));
			const nextPageNumber = pageCount[game][onlinePath] + 1;
			if (maxRef.current > 0 && nextPageNumber - 1 > maxRef.current) {
				loadingRef.current = false;
				return;
			}
			prevLoadedRef.current = (nextPageNumber - 1) * 15;
			try {
				if (onlinePath.startsWith("home")) {
					await nextPage(apiClient.home({ page: nextPageNumber, type: onlineType }), onlinePath);
				} else if (onlinePath.startsWith("Skins") || onlinePath.startsWith("Other") || onlinePath.startsWith("UI")) {
					let cat = onlinePath.split("&_sort=")[0];
					await nextPage(apiClient.category({ cat, sort: onlineSort, page: nextPageNumber }), onlinePath);
				} else if (onlinePath.startsWith("search/")) {
					let term = onlinePath.replace("search/", "").split("&_type=")[0];
					if (term.trim().length == 0) return;
					await nextPage(apiClient.search({ term, type: onlineType, page: nextPageNumber }), onlinePath);
				}
				pageCount[game][onlinePath] = nextPageNumber;
				setLoadError("");
			} catch (err) {
				// error("[IMM] Failed to load next online page:", err);
				setLoadError("Failed to load online data.");
			} finally {
				loadingRef.current = false;
			}
		}
	}, [onlinePath, onlineType, onlineSort, game, onlineData, nextPage]);
	const scrollTimeoutRef = useRef<number | null>(null);
	// const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const updateVisibilityRange = useCallback(() => {
		if (!containerRef.current) return;

		const box = containerRef.current.getBoundingClientRect();
		let diff = 0;
		const scale = parseInt((document.documentElement.style.fontSize || "16px").replace("px", "")) / 16;
		if (carouselRef.current) {
			diff = carouselRef.current.getBoundingClientRect().height + 42 * scale;
		}
		const scrollTop = containerRef.current.scrollTop - diff;
		const itemHeight = 304 * scale;
		const itemWidth = 256 * scale;
		const itemsPerRow = Math.floor(box.width / itemWidth);

		const newStart = Math.floor(scrollTop / itemHeight) * itemsPerRow;
		const newEnd = Math.ceil((scrollTop + box.height) / itemHeight) * itemsPerRow - 1;

		// Only update if range actually changed
		setVisibleRange((prev) => {
			if (prev.start !== newStart || prev.end !== newEnd) {
				return { start: newStart, end: newEnd };
			}
			return prev;
		});
	}, [containerRef.current, carouselRef.current, game]);
	const handleScroll = useCallback(() => {
		// Debounce visibility calculations
		if (initial) {
			setInitial(false);
		}
		// if (!scrollIntervalRef.current) {
		// 	scrollIntervalRef.current = setInterval(() => {
		// 		updateVisibilityRange();
		// 		// Check for infinite scroll using optimized method
		// 		checkLoadMore();
		// 	}, 250); // Adjust interval as needed
		// }
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		scrollTimeoutRef.current = setTimeout(() => {
			// if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
			// scrollIntervalRef.current = null;
			updateVisibilityRange();
			// Check for infinite scroll using optimized method
			checkLoadMore();
		}, 50); // ~60fps
	}, [updateVisibilityRange, checkLoadMore, containerRef.current, carouselRef.current, initial]);
	async function initialLoad(url: string, onlinePath: string, controller: AbortController) {
		fetch(url, { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error(`Request failed with ${res.status}`);
				return res.json();
			})
			.then((data) => {
				if (controller.signal.aborted) return;
				maxRef.current = data._aMetadata._nRecordCount / (data?._aMetadata?._nPerPage || 15);
				setOnlineData((prev) => {
					return {
						...prev,
						[onlinePath]: data._aRecords,
					};
				});
				setTimeout(() => {
					checkLoadMore();
				}, 100);
				loadingRef.current = false;
				setLoadError("");
			})
			.catch(() => {
				if (controller.signal.aborted) return;

				setLoadError("Failed to load online data.");
				loadingRef.current = false;
			});
	}
	useEffect(() => {
		const controller = new AbortController();
		if (containerRef.current) {
			containerRef.current.scrollTo({ top: 0 });
		}
		setVisibleRange({ start: -1, end: -1 });
		prevLoadedRef.current = 0;
		maxRef.current = 0;
		setLoadError("");
		setInitial(true);
		//info("fetching1", onlineData,onlinePath);
		//info("fetching2");
		//info("fetching3");
		//info("fetching", onlinePath, types);
		if (!onlineData[game][onlinePath]) {
			// info("fetching", onlinePath);
			pageCount[game][onlinePath] = 1;
			loadingRef.current = true;
			if (onlinePath.startsWith("home")) {
				fetch(apiClient.banner(), { signal: controller.signal })
					.then((res) => {
						if (!res.ok) throw new Error(`Request failed with ${res.status}`);
						return res.json().then((data) => {
							if (controller.signal.aborted) return;
							setOnlineData((prev) => {
								return {
									...prev,
									[game]: {
										...prev[game],
										banner: data,
									},
								};
							});
						});
					})
					.catch(() => {
						if (controller.signal.aborted) return;
						// error("[IMM] Failed to load online banner:", err);
					});
				initialLoad(apiClient.home({ type: onlineType }), onlinePath, controller);
			} else if (types.some((t) => onlinePath.startsWith(t._sName) || onlinePath.startsWith("Skins"))) {
				initialLoad(
					apiClient.category({ cat: onlinePath.split("&_sort=")[0], sort: onlineSort, page: 1 }),
					onlinePath,
					controller
				);
			} else if (onlinePath.startsWith("search/")) {
				let term = onlinePath.replace("search/", "").split("&_type=")[0];
				if (term.trim().length > 0)
					initialLoad(apiClient.search({ term, type: onlineType, page: 1 }), onlinePath, controller);
				else loadingRef.current = false;
			}
		} else {
			const cached = (onlineData[game][onlinePath] as OnlineMod[]) || [];
			pageCount[game][onlinePath] = Math.max(1, Math.ceil(cached.length / 15));
			prevLoadedRef.current = Math.max(0, (pageCount[game][onlinePath] - 1) * 15);
			loadingRef.current = false;
		}
		return () => {
			controller.abort();
		};
	}, [onlinePath, onlineType, game, types, onlineSort]);
	// Memoize the current timestamp to avoid recalculation on every render
	const now = useMemo(() => Date.now() / 1000, [onlinePath]);
	// Memoize filtered banner data
	const filteredBannerData = useMemo(() => {
		if (!onlineData[game]?.banner) return [];
		return (onlineData[game].banner as OnlineMod[]).filter(
			(item) => (item._sModelName == "Mod" || onlineType == "") && (nsfw || item._sInitialVisibility != "hide")
		);
	}, [onlineData[game]?.banner, game, onlineType, nsfw]);

	// Memoize filtered online data
	const filteredOnlineData = useMemo(() => {
		if (!onlineData[game][onlinePath]) return [];
		return (onlineData[game][onlinePath] as OnlineMod[]).filter((item) => nsfw || item._sInitialVisibility != "hide");
	}, [onlineData, game, onlinePath, nsfw]);
	// Memoize animation variants to prevent recreation on every render
	const animationVariants = useMemo(
		() => ({
			hidden: { opacity: initial ? 0 : 1, y: 20 },
			visible: { opacity: 1, y: 0 },
			exit: { opacity: initial ? 0 : 1, y: -20 },
		}),
		[initial]
	);

	// Memoize transition config
	const transitionConfig = useCallback(
		(index: number) => ({
			duration: 0.3,
			ease: "easeOut" as const,
			delay: initial ? 0.05 * index : 0,
		}),
		[initial]
	);

	// Determine if item should be visible
	const isItemVisible = useCallback(
		(index: number) => {
			const { start, end } = visibleRange;
			return start === -1 || (index >= start && index <= end) ? 0 : index < start ? 2 : 1;
		},
		[visibleRange]
	);
	//info(selected);
	console.log(filteredBannerData);
	return (
		<CRD
			className="w-full h-full relative duration-200"
			style={{
				filter: rightSlideOverOpen ? "blur(calc(var(--blur-xs))) brightness(0.8)" : "",
			}}
		>
			<div
				ref={containerRef}
				onScroll={handleScroll}
				key={game}
				className="flex flex-col pt-4 items-center h-full min-w-full overflow-x-hidden overflow-y-auto duration-300"
			>
				<div className="flex items-center justify-center h-auto min-w-full" ref={carouselRef}>
					<AnimatePresence mode="popLayout">
						{onlinePath.startsWith("home") && filteredBannerData.length > 0 && (
							<motion.div
								layout
								key={"banner"}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 0 }}
								transition={transitionConfig(0)}
								className="aspect-video w-full max-w-[55vw] xl:max-w-3xl duration-300 transition-[max-width] mb-4"
							>
								<Carousel data={filteredBannerData || []} blur={nsfw == 1} onModClick={onModClick} />
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				<AnimatePresence mode="popLayout">
					{loadError && <div className="text-destructive text-xs py-2">{loadError}</div>}
					<motion.div
						className="min-h-fit card-grid card-grid-online grid justify-center w-full py-4"
						layout
						key={"content" + onlinePath}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={transitionConfig(0)}
					>
						<AnimatePresence mode="popLayout">
							{filteredOnlineData.map((item, index) => {
								const isVisible = isItemVisible(index);
								return (
									<motion.div
										key={`${item._sModelName}-${item._idRow}`}
										layout
										variants={animationVariants}
										initial="hidden"
										animate="visible"
										exit="exit"
										transition={transitionConfig(index - prevLoadedRef.current || 0)}
										onMouseUp={(e) => onModClick(e, item)}
										onContextMenu={preventContextMenu}
									>
										{isVisible ? (
											<div className="card-generic card-online"></div>
										) : (
											// <></>
											<CardOnline {...item} now={now} blur={nsfw == 1} show={"Show"} />
										)}
									</motion.div>
								);
							})}
						</AnimatePresence>
					</motion.div>
					{(loadingRef.current || pageCount[game][onlinePath] < maxRef.current) && (
						<motion.div
							className="min-w-8 min-h-8 flex justify-center my-2"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							key={"loader"}
							transition={transitionConfig(0)}
						>
							<LoaderIcon className="min-w-8 min-h-8 animate-spin text-accent " />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			{rightSlideOverOpen && (
				<div
					className="absolute top-0 left-0 w-full h-full z-100"
					onClick={() => {
						setRightSlideOverOpen(false);
					}}
				/>
			)}
		</CRD>
	);
}

export default Main;
