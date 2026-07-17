import textData from "@/textData.json";
import { SAVED_LANG } from "@/utils/vars";
import { useAtomValue } from "jotai";

export type TextKey = keyof (typeof textData)["en"];

export function useText() {
	const language = useAtomValue(SAVED_LANG) || "en";
	const selected = textData[language] as any as Record<TextKey, string>;

	return (key: TextKey, values?: Record<string, string | number>) => {
		let value = selected[key] || textData.en[key];
		if (values) {
			for (const [name, replacement] of Object.entries(values)) {
				value = (value as string).replaceAll(`{${name}}`, String(replacement));
			}
		}
		return value as string;
	};
}
