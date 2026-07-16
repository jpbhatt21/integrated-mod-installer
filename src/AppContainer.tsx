import { useAtomValue } from "jotai";
import { ERR, INIT_DONE } from "./utils/vars";
import { useEffect } from "react";
import App from "./App";

function AppContainer() {
	const error = useAtomValue(ERR);
	const init = useAtomValue(INIT_DONE);
	useEffect(() => {
		if (error) {
			throw new Error(error);
		}
	}, [error]);
	return init ? <App /> : <></>;
}

export default AppContainer;
