import fs from "node:fs";
import path from "node:path";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = async () => {
	// Assuming the frontend is running from zzuli-developers/frontend
	const readmePath = path.resolve("../README.md");

	try {
		const fileContent = fs.readFileSync(readmePath, "utf-8");
		const lines = fileContent.split("\n");

		const projects: Array<{ name: string; url: string; description: string }> =
			[];
		const alumni: Array<{
			nickname: string;
			github: { text: string; url: string | null };
			blog: { text: string; url: string | null } | null;
			avatar: string | null;
		}> = [];

		let currentSection = "";

		for (const line of lines) {
			const trimmedLine = line.trim();

			// Detect Section Headers
			if (trimmedLine.startsWith("## ")) {
				currentSection = trimmedLine.substring(3).trim();
				continue;
			}

			// Parse Projects
			if (currentSection === "项目列表") {
				// Format: - [Name](Link): Description
				const match = trimmedLine.match(/^- \[(.*?)\]\((.*?)\): (.*)$/);
				if (match) {
					projects.push({
						name: match[1],
						url: match[2],
						description: match[3],
					});
				}
			}
			// Parse Alumni
			else if (currentSection === "校友大合集") {
				// Skip headers and separators
				if (
					trimmedLine.startsWith("| 昵称") ||
					trimmedLine.startsWith("| ---") ||
					!trimmedLine.startsWith("|")
				) {
					continue;
				}

				const cols = trimmedLine
					.split("|")
					.map((c: string) => c.trim())
					.filter((c: string) => c !== "");

				if (cols.length >= 2) {
					const nickname = cols[0];
					const githubRaw = cols[1];
					const blogRaw = cols[2] || "";

					// Helper to extract link markdown [text](url)
					const parseLink = (
						md: string,
					): { text: string; url: string | null } => {
						const match = md.match(/\[(.*?)\]\((.*?)\)/);
						if (match) {
							return { text: match[1], url: match[2] };
						}
						return { text: md, url: null };
					};

					const github = parseLink(githubRaw);
					const blog = blogRaw ? parseLink(blogRaw) : null;

					let avatar = null;
					if (github.url) {
						const match = github.url.match(/github\.com\/([^/]+)/);
						if (match) {
							avatar = `https://github.com/${match[1]}.png`;
						}
					}

					alumni.push({
						nickname,
						github,
						blog,
						avatar,
					});
				}
			}
		}

		return {
			projects,
			alumni,
		};
	} catch (error) {
		console.error("Error reading README.md:", error);
		return {
			projects: [],
			alumni: [],
		};
	}
};
