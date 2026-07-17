import { useAtom, useAtomValue } from "jotai";
import { BROWSE_PATH, BROWSE_SETTINGS, BROWSE_SORT, BROWSE_TYPE, CATEGORIES } from "@/utils/vars";
import { TYPES, UNCATEGORIZED } from "@/utils/consts";
import { Games } from "@/utils/types";
import { Button } from "@/components/ui/button";
import { JSX, useEffect, useRef, useState } from "react";
import {
	AppWindowIcon,
	BotIcon,
	FileQuestionIcon,
	GroupIcon,
	ShieldQuestion,
	ShirtIcon,
	ShoppingBagIcon,
	SwordsIcon,
	UserIcon,
	VenetianMaskIcon,
} from "lucide-react";
import MiniSearch from "minisearch";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "motion/react";
import { useText } from "@/hooks/use-text";
const leftSidebarOpen = true; // Placeholder for the actual state management
const iconMap: { [key: string]: JSX.Element } = {
	Skin: <ShirtIcon className="w-6 h-6" />,
	Characters: <UserIcon className="w-6 h-6" />,
	Operators: <UserIcon className="w-6 h-6" />,
	Bangboo: <BotIcon className="w-6 h-6" />,
	UI: <AppWindowIcon className="w-6 h-6" />,
	Other: <ShieldQuestion className="w-6 h-6" />,
	Weapons: <SwordsIcon className="w-6 h-6" />,
	Objects: <ShoppingBagIcon className="w-6 h-6" />,
	Entity: <VenetianMaskIcon className="w-6 h-6" />,
};
function LeftSideBar() {
	const t = useText();
	const game = useAtomValue(BROWSE_SETTINGS).game as Games;
	const searchDb = useRef<MiniSearch<any> | null>(null);
	const categories = useAtomValue(CATEGORIES);
	const [onlinePath, setOnlinePath] = useAtom(BROWSE_PATH);
	const [onlineType, setOnlineType] = useAtom(BROWSE_TYPE);
	const [onlineSort, setOnlineSort] = useAtom(BROWSE_SORT);
	const [displayCategories, setDisplayCategories] = useState(categories[game]);
	const [searchTerm, setSearchTerm] = useState("");
	useEffect(() => {
		searchDb.current = null;
		setOnlinePath(`home&_type=${onlineType}`);
		setOnlineSort("");
	}, [game, setOnlinePath, setOnlineType, setOnlineSort]);
	useEffect(() => {
		console.log(categories)
		let nextCategories = categories[game];
		if (searchTerm.trim() === "") {
			nextCategories = categories[game];
		} else if (categories && categories[game].length > 0) {
			if (!searchDb.current) {
				searchDb.current = new MiniSearch({
					idField: "_idRow", // field to use as document ID
					fields: ["_sName"], // fields to index for full-text search
					storeFields: Object.keys(categories[game][0]), // fields to return with search results
					searchOptions: { prefix: true, fuzzy: 0.2 },
				});
				searchDb.current.addAll(categories[game]);
			}
			nextCategories = searchDb.current.search(searchTerm).map((result) => result) as unknown as typeof categories.WW;
		}
		setDisplayCategories(
			nextCategories.filter((_, index) =>
				["Weapons", "Bows", "Catalysts", "Claymores", "Polearms", "Swords"].includes(
					onlinePath.split("&_")[0].split("/").pop() as string
				)
					? index >= nextCategories.findIndex((c) => c._sName == "Bows") &&
						index <= nextCategories.findIndex((c) => c._sName == "Swords")
					: true
			)
		);
	}, [searchTerm, categories, onlinePath, game]);
	return (
		<AnimatePresence mode="wait">
			<motion.div className="w-80 shrink-0 flex flex-col gap-2 h-full "
			initial={{ opacity: 0, y: "2%" }}
			animate={{ opacity: 1, y: "0%" }}
			exit={{ opacity: 0, y: "2%" }}
			key={"leftsidebar" + game}
			>
			<Card className="py-3  duration-200 gap-3">
				<CardContent
					className="min-h-fit  duration-200 grid gap-2 items-center justify-center w-full grid-cols-2 px-2"
					style={{
						gridTemplateColumns: leftSidebarOpen
							? game == "WW"
								? "repeat(3, minmax(0, 1fr))"
								: ""
							: "repeat(1, minmax(0, 1fr))",
					}}
				>
					{TYPES[game].map((category) => {
						return (
							<div className="flex items-center justify-center w-full">
								<Button
									key={"filter" + category._sName}
									id={"type " + category._sName}
									onClick={() => {
										if (onlinePath.startsWith(category._sName)) {
											setOnlinePath("home&_type=" + onlineType);
											return;
										}
										setOnlinePath(`${category._sName}&_sort=${onlineSort}`);
									}}
									className={
										"w-full min-w-fit justify-start	 " +
										(onlinePath.startsWith(category._sName) && " bg-accent bgaccent   text-background")
									}
									style={{
										width: leftSidebarOpen ? "" : "2.5rem",
										paddingInline: leftSidebarOpen ? "" : "0.25rem",
										justifyContent: leftSidebarOpen ? "start" : "center",
									}}
								>
									{game == "GI" ? (
										<img
											src={category._sIconUrl}
											className="aspect-square w-8 h-8 duration-200"
											style={{
												filter: onlinePath.startsWith(category._sName) ? "invert(1) hue-rotate(180deg)" : "",
											}}
										/>
									) : (
										iconMap[category._sName] || <ShieldQuestion className="w-6 h-6" />
									)}

									{leftSidebarOpen && <label className="w-full text-center"> {category._sName}</label>}
								</Button>
							</div>
						);
					})}
				</CardContent>
			</Card>
			<Card className="py-3 duration-200 h-full overflow-hidden gap-3">
				<CardContent className="flex  duration-200 w-full h-full flex-col px-2">
					<Input
						placeholder={t("searchCats")}
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="mb-2 min-h-8"
					/>
					<div className="flex flex-row flex-wrap gap-2 items-start max-h-full overflow-auto justify-items-start justify-start min-w-full ">
						<AnimatePresence mode="popLayout">
							{displayCategories?.map((cat) => (
								<motion.div
									initial={{ opacity: 0, y: "100%" }}
									animate={{ opacity: 1, y: "0%" }}
									exit={{ opacity: 0, y: "100%" }}
									key={cat._idRow}
									layout
								>
									<Button
										key={cat._sName}
										onClick={() => {
											//check if control is pressed
											// const ctrl = e.ctrlKey || e.metaKey;

											if (cat._special) {
												return;
											}
											if (onlinePath.split("&_").shift() === `Skins/${cat._sName}`) {
												setOnlinePath("home&_type=" + onlineType);
												return;
											}
											setOnlinePath(`Skins/${cat._sName}&_sort=${onlineSort}`);
										}}
										style={{
											scale: cat._special ? "0" : "1",
											marginRight: cat._special ? "-9.5rem" : "0rem",
											padding: cat._special ? "0rem" : "0.5rem",
										}}
										className={
											" data-zzz:rounded-lg " +
											(onlinePath.split("&_").shift() === `Skins/${cat._sName}`
												? " bg-accent bgaccent    text-background"
												: "")
										}
									>
										{cat._sName == "All" ? (
											<>
												<GroupIcon className="aspect-square h-full pointer-events-none" />
												<span className="">{t("all")}</span>
											</>
										) : cat._sName == UNCATEGORIZED ? (
											<>
												<FileQuestionIcon className="aspect-square h-full pointer-events-none" />
												<span className="">{t("uncategorized")}</span>
											</>
										) : (
											<>
												<img
													className="aspect-square min-w-6 w-6 scale-120 rounded-full pointer-events-none"
													onError={(e) => {
														e.currentTarget.src = "/who.jpg";
													}}
													src={cat._sIconUrl || "err"}
												/>
												<span className="">{cat._sName}</span>
											</>
										)}
									</Button>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</CardContent>
			</Card>
		</motion.div>
		</AnimatePresence>
	);
}

export default LeftSideBar;
