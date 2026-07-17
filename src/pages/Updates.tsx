import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { DownloadIcon, ExternalLinkIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useText } from "@/hooks/use-text";

interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	hasUpdate: boolean;
	releaseNotes?: string | undefined;
	update?: Update | undefined;
	error?: string | undefined;
	progress?: number | undefined;
	restartRequired?: boolean | undefined;
}

export default function Updates() {
	const t = useText();
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
		currentVersion: "1.0.0",
		latestVersion: "1.0.0",
		hasUpdate: false,
	});
	const [checking, setChecking] = useState(false);
	const [downloading, setDownloading] = useState(false);

	const checkForUpdates = async () => {
		setChecking(true);
		try {
			const [currentVersion, update] = await Promise.all([getVersion(), check()]);
			setUpdateInfo({
				currentVersion,
				latestVersion: update?.version || currentVersion,
				hasUpdate: Boolean(update),
				releaseNotes: update?.body || undefined,
				update: update || undefined,
			});
		} catch (error) {
			setUpdateInfo((prev) => ({ ...prev, error: String(error) }));
		} finally {
			setChecking(false);
		}
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
		checkForUpdates();
	}, []);

	const status = updateInfo.error
		? `Update check failed: ${updateInfo.error}`
		: updateInfo.restartRequired
			? "Update installed. Restart the app to finish."
			: updateInfo.hasUpdate
				? `Version ${updateInfo.latestVersion} is available.`
				: "You're up to date.";

	return (
		<div className="p-6 space-y-6">
			<div>
				<h1 className="text-2xl font-bold">{t("upd")}</h1>
				<p className="text-muted-foreground">{t("checkInstallUpd")}</p>
			</div>

			<Card>
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
						<Button variant="outline" onClick={checkForUpdates} disabled={checking || downloading}>
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
			</Card>

			{updateInfo.hasUpdate && updateInfo.releaseNotes && (
				<Card>
					<CardHeader>
						<CardTitle>What's New in v{updateInfo.latestVersion}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
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
