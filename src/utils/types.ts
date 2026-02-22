export type Games = "WW" | "ZZ" | "GI" | "SR" | "EF" | ""; //| "GI" ;
export type Language = "en" | "cn" | "ru" | "jp" | "kr" | "";
export interface DirEntry {
	name: string;
	isDirectory: boolean;
	icon?: string;
	children?: DirEntry[];
}
export interface config{
	paths:{
		[key in Games]: string;
	};
	categorized: boolean | null;
	askFileDir: boolean;
	saveSource: boolean;

}
export interface Category {
	_idRow: number;
	_sName: string;
	_nItemCount: number;
	_nCategoryCount: number;
	_sUrl: string;
	_sIconUrl: string;
	_sAltIconUrl?: string;
	_special?: boolean;
}
export interface DownloadItem {
	status: "pending" | "downloading" | "completed" | "failed" | "extracting";
	game: Games;
	preview: string;
	category: string;
	source: string;
	file: string;
	name: string;
	fname: string;
	key: string;
	gamePath:string;
	categorized?: boolean;
}
export interface DownloadList {
	queue: DownloadItem[];
	downloading: DownloadItem[];
	completed: DownloadItem[];
	extracting: DownloadItem[];
	failed: DownloadItem[];
}

export interface InstalledItem {
	name: string;
	source: string;
	updated: number;
	viewed: number;
	modStatus: number;
}
export interface OnlineModImage {
	_sType: string;
	_sBaseUrl: string;
	_sFile: string;
	_sFile220?: string;
	_hFile220?: number;
	_wFile220?: number;
	_sFile530?: string;
	_hFile530?: number;
	_wFile530?: number;
	_sFile100: string;
	_hFile100: number;
	_wFile100: number;
}
export interface OnlineModPreviewMedia {
	_aImages: OnlineModImage[];
}
export interface OnlineModSubmitter {
	_idRow: number;
	_sName: string;
	_bIsOnline: boolean;
	_bHasRipe?: boolean;
	_sProfileUrl: string;
	_sAvatarUrl: string;
	_sHdAvatarUrl: string;
	_sUpicUrl?: string;
	_sMoreByUrl?: string;
}
export interface OnlineModCategory {
	_idRow: number;
	_sName: string;
	_sProfileUrl: string;
	_sIconUrl: string;
}
export interface OnlineMod {
	_idRow: number;
	_sModelName: string;
	_sSingularTitle?: string;
	_sIconClasses?: string;
	_sName: string;
	_sProfileUrl: string;
	_tsDateAdded?: number;
	_tsDateModified?: number;
	_tsDateUpdated?: number;
	_bHasFiles?: boolean;
	_aTags?: any[];
	_aFiles?: any[];
	_aPreviewMedia?: OnlineModPreviewMedia;
	_aSubmitter: OnlineModSubmitter;
	_aCategory: OnlineModCategory;
	_aSuperCategory: OnlineModCategory;
	_sVersion?: string;
	_bIsObsolete?: boolean;
	_sInitialVisibility: string;
	_bHasContentRatings?: boolean;
	_nLikeCount: number;
	_nPostCount: number;
	_bWasFeatured?: boolean;
	_nViewCount?: number;
	_bIsOwnedByAccessor?: boolean;
	_sImageUrl?: string;
	_aComments?: any[];
	_sPeriod?: "today" | "yesterday" | "week" | "month" | "3month" | "6month" | "year" | "alltime";
}
export interface OnlineData {
	[key: string]: OnlineMod[] | OnlineMod;
}
