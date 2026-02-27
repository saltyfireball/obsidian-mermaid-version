export {};

declare global {
	interface Window {
		mermaid?: {
			version?: string;
			render: (id: string, code: string) => Promise<{ svg: string }>;
			initialize: (config: Record<string, unknown>) => void;
			mermaidAPI?: {
				version?: string;
			};
			parse: (code: string) => Promise<boolean>;
		};
	}
}
