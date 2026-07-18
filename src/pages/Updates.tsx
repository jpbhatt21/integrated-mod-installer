import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { openUrl } from "@tauri-apps/plugin-opener";
import { DownloadIcon, ExternalLinkIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useText } from "@/hooks/use-text";
import { useAtom, useAtomValue } from "jotai";
import { SAVED_LANG, UPDATE } from "@/utils/vars";
import { checkForUpdates } from "@/utils/init";
export default function Updates() {
	const t = useText();
	const [updateInfo, setUpdateInfo] = useAtom(UPDATE);
	const [checking, setChecking] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const savedLang = useAtomValue(SAVED_LANG)
	const checkForUpdate = async () => {
		setChecking(true);
		await checkForUpdates();
		setChecking(false);
	};

	const downloadUpdate = async () => {
		if (!updateInfo.update) return;
		setDownloading(true);
		try {
			let downloaded = 0;
			let contentLength = 0;
			await updateInfo.update.downloadAndInstall((event) => {
				if (event.event === "Started") contentLength = event.data.contentLength || 0;
				if (event.event === "Progress") downloaded += event.data.chunkLength;
				if (event.event !== "Finished") {
					setUpdateInfo((prev) => ({
						...prev,
						progress: contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : undefined,
					}));
				}
			});
			setUpdateInfo((prev) => ({ ...prev, progress: 100, restartRequired: true }));
		} catch (error) {
			setUpdateInfo((prev) => ({ ...prev, error: String(error) }));
		} finally {
			setDownloading(false);
		}
	};

	useEffect(() => {
		if(!updateInfo.update && !updateInfo.error)
		checkForUpdate();
	}, []);
	const majorChanges:string[] = updateInfo?.releaseNotes? updateInfo?.releaseNotes?.[savedLang]?.major || updateInfo.releaseNotes?.major : [] as string[];
	const minorChanges:string[] = updateInfo?.releaseNotes? updateInfo?.releaseNotes?.[savedLang]?.minor || updateInfo.releaseNotes?.minor : [] as string[];
	const patchChanges:string[] = updateInfo?.releaseNotes? updateInfo?.releaseNotes?.[savedLang]?.patch || updateInfo.releaseNotes?.patch : [] as string[];
	const status = updateInfo.error
		? t("checkFailed", { error: updateInfo.error })
		: updateInfo.restartRequired
			? "Update installed. Restart the app to finish."
			: updateInfo.hasUpdate
				? t("verAvl", { version: updateInfo.latestVersion })
				: t("verUpToDate");

	return (
		<div className="p-6 space-y-6">
			<div>
				<h1 className="text-2xl font-bold">{t("upd")}</h1>
				<p className="text-muted-foreground">{t("checkInstallUpd")}</p>
			</div>

			<Card className="pb-0 overflow-hidden">
				<CardHeader>
					<CardTitle>{t("curVer")}</CardTitle>
					<CardDescription>Integrated Mod Installer</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center justify-between gap-4">
					<div className="space-y-1">
						<p className="text-3xl font-bold">v{updateInfo.currentVersion}</p>
						<p className={updateInfo.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{status}</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={checkForUpdate} disabled={checking || downloading}>
							{checking ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcwIcon className="mr-2 h-4 w-4" />}
							{checking ? t("checking") : t("checkUpd")}
						</Button>
						{updateInfo.hasUpdate && (
							<Button onClick={downloadUpdate} disabled={downloading || updateInfo.restartRequired}>
								{downloading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <DownloadIcon className="mr-2 h-4 w-4" />}
								{downloading
								? `${t("downloading")}${updateInfo.progress === undefined ? "..." : ` ${updateInfo.progress}%`}`
									: updateInfo.restartRequired
									? t("installed")
									: t("downloadUpd")}
							</Button>
						)}
					</div>
				</CardContent>
				<div className="w-full h-2 rounded-b-2xl">
					<div
					className="bg-accent animate-accordion-down"
					style={{
						width: `${updateInfo.progress || 0}%`,
						height: "100%",
						transition: "width 0.3s ease-in-out",
						borderTopRightRadius: updateInfo.progress||0<100 ? "1rem" : 0,
					}}
					/>
				</div>
			</Card>

			{updateInfo.hasUpdate && updateInfo.releaseNotes && (
				<Card>
					<CardContent>
						{majorChanges.length > 0 && (
							<div className="mb-4">
								<h3 className="text-lg font-semibold text-accent">{t("mjr")}</h3>
								<ul className="list-disc list-inside">
									{majorChanges.map((change, index) => (
										<li key={index}>{change}</li>
									))}
								</ul>
							</div>
						)}
						{minorChanges.length > 0 && (
							<div className="mb-4">
								<h3 className="font-semibold text-accent">{t("mnr")}</h3>
								<ul className="list-disc text-sm list-inside">
									{minorChanges.map((change, index) => (
										<li key={index}>{change}</li>
									))}
								</ul>
							</div>
						)}
						{patchChanges.length > 0 && (
							<div className="mb-4">
								<h3 className="font-semibold text-accent">{t("patch")}</h3>
								<ul className="list-disc text-sm list-inside">
									{patchChanges.map((change, index) => (
										<li key={index}>{change}</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<Card>
				<CardContent className="flex items-center justify-between pt-6">
					<div>
						<p className="font-medium">{t("viewChangelog")}</p>
						<p className="text-sm text-muted-foreground">{t("changelogDesc")}</p>
					</div>
					<Button variant="ghost" size="sm" onClick={() => openUrl("https://github.com/jpbhatt21/integrated-mod-installer/releases")}>
						<ExternalLinkIcon className="mr-2 h-4 w-4" />
						{t("viewChangelogBtn")}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
