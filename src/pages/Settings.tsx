import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GAME_ICONS, GAME_NAMES, GAMES } from "@/utils/consts";
import { useAtom } from "jotai";
import { CONFIG } from "@/utils/vars";
import { FolderIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { saveConfig, selectPath } from "@/utils/filesys";
import { exists } from "@tauri-apps/plugin-fs";
import { join } from "@/utils/utils";
import { getModDir, readXXMIConfig } from "@/utils/init";
import { addToast } from "@/_Toaster/ToastProvider";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Settings() {
	const [config, setConfig] = useAtom(CONFIG);
	return (
		<div className="p-4 space-y-4">
			<div>
				<h1 className="text-2xl font-bold">Settings</h1>
				<p className="text-muted-foreground">Configure your preferences</p>
			</div>

			<Card className="flex flex-row w-full justify-between">
				<CardHeader className="w-full">
					<CardTitle>Minimize to Tray</CardTitle>
					<CardDescription>Minimize the app to the system tray instead of closing it</CardDescription>
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
						<CardTitle>Mod Directories</CardTitle>
						<CardDescription>Select the folders where mods should be installed to for each game</CardDescription>
					</CardHeader>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button className="" onClick={() => {}}>
								Auto-detect via XXMI
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="items-center  justify-evenly">
							<div className="min-h-fit font-semibold text-accent  text-3xl">Confirm XXMI Directory</div>
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
												message: "Unable to read XXMI config.",
												type: "error",
											});
										}
									}
								}}
							>
								Verify
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
					<CardTitle>Concurrent Downloads</CardTitle>
					<CardDescription>Maximum number of downloads to run simultaneously</CardDescription>
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
					<CardTitle>Save Preview Image</CardTitle>
					<CardDescription>Downloads a preview image from gamebanana for each mod</CardDescription>
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
			<Card className="flex flex-row w-full justify-between">
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
			</Card>
			<Card>
				<CardHeader className="w-full">
					<CardTitle>Mods Directory Structure</CardTitle>
					<CardDescription>Whether to create subdirectories for each mod category or not</CardDescription>
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
							<TabsTrigger value="0">Flat</TabsTrigger>
							<TabsTrigger value="1">Categorized</TabsTrigger>
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
