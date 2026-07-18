import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
export async function init() {
	try {
		let perms = await isPermissionGranted();
		return perms || (await requestPermission()) === "granted";
	} catch (e) {
		console.error("Notification permission check failed:", e);
		return false;
	}
}
export async function sendNotif(title: string, body: string) {
	try {
		let perms = await init();
		console.log("Notification permission granted:", perms);
		if (perms) {
			sendNotification({ title, body });
		}
	} catch (e) {
		console.error("Failed to send notification:", e);
	}
}
