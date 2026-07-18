import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GAME_ICONS, GAME_NAMES, GAMES, LANG_LIST } from "@/utils/consts";
import { useAtom } from "jotai";
import { CONFIG, SAVED_LANG } from "@/utils/vars";
import { useText } from "@/hooks/use-text";
import { FolderIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { saveConfig, selectPath } from "@/utils/filesys";
import { exists } from "@tauri-apps/plugin-fs";
import { join } from "@/utils/utils";
import { getModDir, readXXMIConfig } from "@/utils/init";
import { addToast } from "@/_Toaster/ToastProvider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TEXT from "@/textData.json";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
export default function Settings() {
	const [config, setConfig] = useAtom(CONFIG);
	const [language, setLanguage] = useAtom(SAVED_LANG);
	const [langAlertData, setLangAlertData] = useState({ prev: "en", new: "en" } as {
		prev: keyof typeof TEXT;
		new: keyof typeof TEXT;
	});
	const [alertOpen, setAlertOpen] = useState(false);
	const t = useText();
	return (
		<div className="p-4 space-y-4">
			<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
				<AlertDialogContent
				>
					{ 
						<>
							<div className=" flex flex-col items-center w-120 gap-6 mt-6 text-center">
								<div className="flex flex-col items-center justify-center gap-2 text-xl text-gray-200">
									{TEXT[langAlertData.prev].Change + TEXT[langAlertData.prev].Languages[langAlertData.new]}
									?
									<Separator />
									<span
										style={{
											fontFamily: `var(--game-font-${langAlertData.new})`,
										}}
									>
										{TEXT[langAlertData.new].Change + TEXT[langAlertData.new].Languages[langAlertData.new]}?
									</span>
								</div>

								{langAlertData.new !== "en" && (
									<div className="max-w-96 text-accent flex flex-col gap-4 text-sm">
										<span>
											{TEXT[langAlertData.prev].Warning1 + " "}
											{TEXT[langAlertData.prev].Warning2}
										</span>
										<span
											style={{
												fontFamily: `var(--game-font-${langAlertData.new})`,
											}}
										>
											{TEXT[langAlertData.new].Warning1 + " "}
											{TEXT[langAlertData.new].Warning2}
										</span>
									</div>
								)}
							</div>
							<div className="flex justify-between w-120 gap-4 mt-4">
								<AlertDialogCancel className="min-w-24 duration-300">
									{TEXT[langAlertData.prev].Cancel} |
									<span
										style={{
											fontFamily: `var(--game-font-${langAlertData.new})`,
										}}
									>
										{TEXT[langAlertData.new].Cancel}
									</span>
								</AlertDialogCancel>
								<AlertDialogAction
									className="min-w-24 text-accent hover:bg-accent hover:text-background "
									onClick={() => {
										setLanguage(langAlertData.new);
										setAlertOpen(false);
									}}
								>
									{TEXT[langAlertData.prev].Confirm} |
									<span
										style={{
											fontFamily: `var(--game-font-${langAlertData.new})`,
										}}
									>
										{TEXT[langAlertData.new].Confirm}
									</span>
								</AlertDialogAction>
							</div>
						</>
					}
				</AlertDialogContent>
			</AlertDialog>
			<div>
				<h1 className="text-2xl font-bold">{t("set")}</h1>
				<p className="text-muted-foreground">{t("prefs")}</p>
			</div>
			<Card className="flex flex-row w-full justify-between">
				<CardHeader className="w-full">
					<CardTitle>{t("lang")}</CardTitle>
					<CardDescription>{t("langDesc")}</CardDescription>
				</CardHeader>
				<CardContent className="flex w-full max-w-150 items-center">
					<div className="justify-evenly flex w-full ">
						{LANG_LIST.map((lang) => (
							<div
								key={lang.Code}
								className={`hover:brightness-150 flex-col flex items-center justify-center group gap-1 text-sm duration-300 cursor-pointerx select-none`}
								onClick={() => {
									if (language == lang.Code) return;
									setLangAlertData({
										prev: language || "en",
										new: lang.Code as keyof typeof TEXT,
									});
									setAlertOpen(true);
								}}
							>
								<img src={lang.Flag} alt={lang.Name} className="group-hover:scale-120 w-8 h-8 duration-200" />
								<span
									className="text-gray-300 whitespace-nowrap opacity-50 -mt-1.5 group-hover:mt-0 group-hover:-mb-1.5 overflow-hidden text-xs duration-200"
									style={{
										opacity: language == lang.Code ? "1" : "",
										color: language == lang.Code ? "var(--accent)" : "",
										fontFamily: `var(--game-font-${lang.Code})`,
									}}
								>
									{lang.Name}
								</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card className="flex flex-row w-full justify-between">
				<CardHeader className="w-full">
					<CardTitle>{t("minTray")}</CardTitle>
					<CardDescription>{t("minTrayDesc")}</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-1">
					<Switch
						checked={config.minimizeToTray}
						onCheckedChange={(checked) => {
							setConfig((prev) => ({
								...prev,
								minimizeToTray: checked,
							}));
							saveConfig();
							sessionStorage.setItem("minimizeToTray", checked ? "true" : "false");
						}}
					/>
				</CardContent>
			</Card>
			<Card>
				<div className="flex w-full justify-between pr-6">
					<CardHeader className="w-full">
						<CardTitle>{t("modDirs")}</CardTitle>
						<CardDescription>{t("modDirsDesc")}</CardDescription>
					</CardHeader>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button className="" onClick={() => {}}>
								{t("autoXXMI")}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="items-center  justify-evenly">
							<div className="min-h-fit font-semibold text-accent text-3xl">{t("confirmXXMI")}</div>
							<div
								className="flex w-120 items-center gap-2"
								onClick={async () => {
									let path = await selectPath({
										defaultPath: config.XXMI || "",
										directory: true,
										title: `Select XXMI Launcher Folder`,
									});
									if (path) {
										setConfig((prev) => ({
											...prev,
											XXMI: path,
										}));
										saveConfig();
									}
								}}
							>
								<Button className="h-10 w-10">
									<FolderIcon className="max-h-3" />
								</Button>
								<Input className="h-10" readOnly value={config.XXMI} />
							</div>
							<AlertDialogAction
								className="hover:bg-accent hover:text-background"
								onClick={async () => {
									if (config.XXMI) {
										const success = await readXXMIConfig(config.XXMI);
										if (success) {
											await saveConfig();
											await getModDir(true);
											const close = document.getElementById("radix-_r_0_")?.lastElementChild as HTMLButtonElement;
											if (close) close.click();
										} else {
											addToast({
												message: t("xxmiErr"),
												type: "error",
											});
										}
									}
								}}
							>
								{t("verify")}
							</AlertDialogAction>
						</AlertDialogContent>
					</AlertDialog>
				</div>
				<CardContent className="space-y-4">
					{GAMES.map(
						(game) =>
							game && (
								<div
									key={game}
									className="flex items-center gap-2"
									onClick={async () => {
										let path = await selectPath({
											defaultPath: config.paths[game] || "",
											directory: true,
											title: `Select ${GAME_NAMES[game]} Mod Folder`,
										});
										if (path) {
											if (await exists(join(path, "Mods"))) path = join(path, "Mods");
											setConfig((prev) => ({
												...prev,
												paths: {
													...prev.paths,
													[game]: path,
												},
											}));
											saveConfig();
										}
									}}
								>
									<Tooltip>
										<TooltipTrigger className="min-w-8 p-0 mr-0.5">
											<img src={GAME_ICONS[game]} className="w-8 rounded outline-2 h-8" />
										</TooltipTrigger>
										<TooltipContent className="text-background">{GAME_NAMES[game]}</TooltipContent>
									</Tooltip>
									<Button className="h-8 w-8">
										<FolderIcon className="max-h-3" />
									</Button>
									<Input readOnly value={config.paths[game]} className="pr-8 text-ellipsis" />
									{config.paths[game] && (
										<Button
											variant="destructive"
											className="h-7 w-7 -ml-9.5"
											onClick={(e) => {
												e.stopPropagation();
												setConfig((prev) => ({
													...prev,
													paths: {
														...prev.paths,
														[game]: "",
													},
												}));
												saveConfig();
											}}
										>
											<Trash2Icon className="max-h-3" />
										</Button>
									)}
								</div>
							)
					)}
				</CardContent>
			</Card>
			<Card className="flex flex-row w-full justify-between">
				<CardHeader className="w-full">
					<CardTitle>{t("concDl")}</CardTitle>
					<CardDescription>{t("concDlDesc")}</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-1">
					<Button
						className="max-h-6 max-w-6"
						onClick={() => {
							if (config.concDl > 1) {
								setConfig((prev) => ({
									...prev,
									concDl: config.concDl - 1,
								}));
								saveConfig();
							}
						}}
					>
						<MinusIcon className="max-w-2" />
					</Button>
					<Input
						type="number"
						key={config.concDl}
						className="w-12 appearance-none text-center"
						defaultValue={config.concDl || 1}
						min={1}
						max={99}
						onBlur={(e) => {
							const val = parseInt(e.target.value);
							if (val >= 1 && val <= 99) {
								setConfig((prev) => ({
									...prev,
									concDl: val,
								}));
								saveConfig();
							}
						}}
					/>
					<Button
						className="max-h-6 max-w-6"
						onClick={() => {
							if (config.concDl < 99) {
								setConfig((prev) => ({
									...prev,
									concDl: config.concDl + 1,
								}));
								saveConfig();
							}
						}}
					>
						<PlusIcon className="max-w-2" />
					</Button>
				</CardContent>
			</Card>
			<Card className="flex flex-row w-full justify-between">
				<CardHeader className="w-full">
					<CardTitle>{t("savePreview")}</CardTitle>
					<CardDescription>{t("savePreviewDesc")}</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-1">
					<Switch
						checked={config.preview}
						onCheckedChange={(checked) => {
							setConfig((prev) => ({
								...prev,
								preview: checked,
							}));
							saveConfig();
						}}
					/>
				</CardContent>
			</Card>
			{/* <Card className="flex flex-row w-full justify-between">
				<CardHeader className="w-full">
					<CardTitle>Save Mod Source</CardTitle>
					<CardDescription>
						Create an HTML file in the mod's directory to redirect to the mod's source page
					</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-1">
					<Switch
						checked={config.source}
						onCheckedChange={(checked) => {
							setConfig((prev) => ({
								...prev,
								source: checked,
							}));
							saveConfig();
						}}
					/>
				</CardContent>
			</Card> */}
			<Card>
				<CardHeader className="w-full">
					<CardTitle>{t("dirStructure")}</CardTitle>
					<CardDescription>{t("dirStructureDesc")}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Tabs
						value={config.categorized ? "1" : "0"}
						onValueChange={(val) => {
							setConfig((prev) => ({
								...prev,
								categorized: val === "1",
							}));
							saveConfig();
						}}
						className="w-full"
					>
						<TabsList className="bg-background/0 h-10 w-full">
							<TabsTrigger value="0">{t("flat")}</TabsTrigger>
							<TabsTrigger value="1">{t("categorized")}</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className="flex w-full gap-6 px-2 items-center justify-between">
						<div
							className={`flex border duration-200 overflow-hidden rounded flex-col w-1/2 ${config.categorized == false && "border-accent"}`}
							onClick={() => {
								setConfig((prev) => ({ ...prev, categorized: false }));
								saveConfig();
							}}
						>
							{"1234".split("").map((item, index) => (
								<div
									className={"w-full flex  flex-col"}
									style={{
										backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
									}}
								>
									<div
										className={"w-full h-8 flex gap-2 items-center px-2 border-b " + (index !== 0 ? "border-t " : "")}
									>
										<FolderIcon className="w-4 h-4" />
										<Label>Mod {item}</Label>
									</div>
								</div>
							))}
						</div>
						<div
							className={`flex border duration-200 overflow-hidden rounded flex-col w-1/2 ${config.categorized == true && "border-accent"}`}
							onClick={() => {
								setConfig((prev) => ({ ...prev, categorized: true }));
								saveConfig();
							}}
						>
							{[
								{
									_sName: "Character A",
									_sIconUrl: "https://cdn-icons-png.flaticon.com/512/9308/9308984.png",
								},
								{
									_sName: "Character B",
									_sIconUrl: "https://cdn-icons-png.flaticon.com/512/9308/9308987.png",
								},
							].map((item, index) => (
								<div
									className={"w-full flex  flex-col"}
									style={{
										backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
									}}
								>
									<div
										className={"w-full h-8 flex gap-2 items-center px-2 border-b " + (index !== 0 ? "border-t " : "")}
									>
										{item._sIconUrl && (
											<img
												src={item._sIconUrl}
												onError={(e) => {
													e.currentTarget.src = "/who.jpg";
												}}
												className="w-6 h-6 -ml-1 -mr-1 overflow-hidden rounded-full"
												alt="icon"
											/>
										)}
										<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{item._sName}</Label>
									</div>
									<div className="flex flex-col items-center w-full pl-4">
										<div
											className={"w-full h-8 border-l flex gap-2 items-center px-2 "}
											style={{
												backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
											}}
										>
											<FolderIcon className="w-4 h-4" />
											<Label className="w-full pointer-events-none">Mod {index + 1}</Label>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
