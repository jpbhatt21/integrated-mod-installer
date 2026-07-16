import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GAME_ICONS, GAME_NAMES, GAMES } from "@/utils/consts";
import CRD from "./CRD";
import LeftSideBar from "./LeftSideBar/LeftSideBar";
import {  BROWSE_SETTINGS } from "@/utils/vars";
import { useAtom } from "jotai";
import Main from "./Main/Main";
import { apiClient } from "@/utils/api";
import RightSlideOver from "./RightSlideOver/RightSlideOver";
import TopBar from "./TopBar/TopBar";
function Browse({ addToDownloads }: { addToDownloads: (url: string, item: any, mode?: string) => void }) {
	const [browseSettings, setBrowseSettings] = useAtom(BROWSE_SETTINGS);	return (
		<div className="w-full relative flex flex-col p-1 space-y-2 min-h-[calc(100vh-3.5rem)] h-[calc(100vh-3.5rem)] overflow-hidden">
			<div className="min-h-16 flex gap-2">
				<CRD className="flex w-80 shrink-0 items-center justify-evenly">
					{GAMES.map((game) => (
						<div
							key={game}
							className="p-1 hover:bg-muted/50 rounded-lg cursor-pointer"
							onClick={() => {
								setBrowseSettings((prev) => {
									prev.game = game;
									return { ...prev };
								});
								apiClient.setGame(game as any);
							}}
						>
							<Tooltip>
								<TooltipTrigger className="min-w-8 p-0 flex items-center hover:ring-0 hover:outline-0 justify-center">
									<img src={GAME_ICONS[game]} className="w-8 rounded outline-2 h-8 duration-200 transition-all"
									style={{
										outlineWidth:game == browseSettings.game?"4px":"",
										outlineColor: game == browseSettings.game ? "var(--accent)" : "",
										scale: game == browseSettings.game ? "1.1" : "1",
									}}
									/>
								</TooltipTrigger>
								<TooltipContent className="text-background">{GAME_NAMES[game]}</TooltipContent>
							</Tooltip>
						</div>
					))}
				</CRD>
				<TopBar/>
			</div>
			<div className="flex w-full min-h-[calc(100vh-8.5rem)] gap-2 h-[calc(100vh-8.5rem)]">
				<LeftSideBar />
				<Main />
			</div>

			<RightSlideOver addToDownloads={addToDownloads} />
		</div>
	);
}

export default Browse;
