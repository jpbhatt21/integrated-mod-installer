import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	hasUpdate: boolean;
	releaseNotes?: string;
	downloadUrl?: string;
}

export default function Updates() {
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
			// TODO: Implement actual update check via Tauri
			// const result = await invoke<UpdateInfo>("check_for_updates");
			// setUpdateInfo(result);

			// Mock for now
			await new Promise((resolve) => setTimeout(resolve, 1000));
			setUpdateInfo({
				currentVersion: "1.0.0",
				latestVersion: "1.0.0",
				hasUpdate: false,
			});
		} catch (error) {
			console.error("Failed to check for updates:", error);
		} finally {
			setChecking(false);
		}
	};

	const downloadUpdate = async () => {
		setDownloading(true);
		try {
			// TODO: Implement actual update download via Tauri
			await new Promise((resolve) => setTimeout(resolve, 2000));
		} catch (error) {
			console.error("Failed to download update:", error);
		} finally {
			setDownloading(false);
		}
	};
	return (
		<div className="p-4 space-y-4">
			<div>
				<h1 className="text-2xl font-bold">Updates</h1>
				<p className="text-muted-foreground">Check for and install application updates</p>
			</div>

			{/* Tracking Settings */}
			<Card>
				<CardHeader>
					<CardTitle>To-do</CardTitle>
					<CardDescription>---</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
	return (
		<div className="p-6 space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Updates</h1>
				<p className="text-muted-foreground">Check for and install application updates</p>
			</div>

			{/* Current Version */}
			<Card>
				<CardHeader>
					<CardTitle>Current Version</CardTitle>
					<CardDescription>You are running Screen Time Manager</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<p className="text-3xl font-bold">v{updateInfo.currentVersion}</p>
							<p className="text-sm text-muted-foreground">
								{updateInfo.hasUpdate ? `Update available: v${updateInfo.latestVersion}` : "You're up to date!"}
							</p>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={checkForUpdates} disabled={checking}>
								{checking ? (
									<>
										<svg
											className="animate-spin -ml-1 mr-2 h-4 w-4"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
											></circle>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										Checking...
									</>
								) : (
									"Check for Updates"
								)}
							</Button>
							{updateInfo.hasUpdate && (
								<Button onClick={downloadUpdate} disabled={downloading}>
									{downloading ? "Downloading..." : "Download Update"}
								</Button>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Update Status */}
			<Card>
				<CardHeader>
					<CardTitle>Update Status</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3">
						{updateInfo.hasUpdate ? (
							<>
								<div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
								<span>New version available</span>
							</>
						) : (
							<>
								<div className="h-3 w-3 rounded-full bg-green-500" />
								<span>Your app is up to date</span>
							</>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Release Notes */}
			{updateInfo.hasUpdate && updateInfo.releaseNotes && (
				<Card>
					<CardHeader>
						<CardTitle>What's New in v{updateInfo.latestVersion}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="prose prose-sm dark:prose-invert">
							<p className="text-muted-foreground whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Auto-update Settings */}
			<Card>
				<CardHeader>
					<CardTitle>Update Preferences</CardTitle>
					<CardDescription>Configure automatic update behavior</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="font-medium">Automatic Updates</p>
							<p className="text-sm text-muted-foreground">Automatically download and install updates</p>
						</div>
						<Button variant="outline" size="sm">
							Coming Soon
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Changelog Link */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">View Full Changelog</p>
							<p className="text-sm text-muted-foreground">See all previous versions and updates</p>
						</div>
						<Button variant="ghost" size="sm">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="mr-2"
							>
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
								<polyline points="15 3 21 3 21 9" />
								<line x1="10" x2="21" y1="14" y2="3" />
							</svg>
							View Changelog
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
