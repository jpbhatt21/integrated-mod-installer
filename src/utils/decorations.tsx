import { Button } from "@/components/ui/button";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MinusIcon, RectangleHorizontalIcon, XIcon } from "lucide-react";
const appWindow = getCurrentWindow();
function Decorations() {
	return (
		<div data-tauri-drag-region className="min-h-8 fixed top-0 select-none w-screen game-font z-1000 flex items-center">
			<div className="min-w-20" />
			<div className="w-full pointer-events-none font-bold mr-8 flex opacity-75 justify-center">
				Integrated Mod Installer
			</div>
			<div className="flex absolute right-2">
				<Button
					onClick={() => appWindow.minimize()}
					className="max-h-4 w-4 rounded-sm border-0 hover:bg-input/50 hover:text-foreground bg-transparent"
				>
					<MinusIcon className="max-h-2.5" />
				</Button>
				<Button
					onClick={() => appWindow.toggleMaximize()}
					className="max-h-4 w-4 rounded-sm border-0 hover:bg-input/50 hover:text-foreground bg-transparent"
				>
					<RectangleHorizontalIcon className="max-h-2.5 scale-x-80" />
				</Button>
				<Button
					onClick={() => {
						const minimizeToTray = sessionStorage.getItem("minimizeToTray") === "true";
						if (minimizeToTray) appWindow.close();
						else appWindow.destroy();
					}}
					variant="destructive"
					className="max-h-4 w-4 rounded-sm hover:bg-destructive/70 border-0 bg-transparent"
				>
					<XIcon className="max-h-3 opacity-80" />
				</Button>
			</div>
		</div>
	);
}

export default Decorations;
