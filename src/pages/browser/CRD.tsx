function CRD({ children, className, ...props }: React.ComponentProps<"div">) {
	return (
		<div className={"border-border/30 bg-background/10 border rounded-lg shadow " + className} {...props}>
			{children}
		</div>
	);
}

export default CRD;
