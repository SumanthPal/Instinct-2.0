import { LOGOS } from "./logos";

export default function Logo({ name, size = 20, className = "" }) {
	const logo = LOGOS[name];
	if (!logo) return null;
	return (
		<svg
			role="img"
			aria-label={logo.title}
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill={logo.color ?? "currentColor"}
			className={className}
		>
			<title>{logo.title}</title>
			<path d={logo.path} />
		</svg>
	);
}
