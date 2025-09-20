#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const https = require("https");

// 配置文件路径
const README_PATH = path.join(__dirname, "README.md");

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 从GitHub API获取用户信息
function fetchGitHubUserInfo(username) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/users/${username}`,
      method: "GET",
      headers: {
        "User-Agent": "zzuli-developers-script",
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 404) {
        reject(new Error(`GitHub用户 ${username} 不存在`));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API请求失败，状态码: ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const userInfo = JSON.parse(data);
          resolve(userInfo);
        } catch (error) {
          reject(new Error("解析GitHub API响应失败"));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`请求GitHub API失败: ${error.message}`));
    });

    req.end();
  });
}

// 读取 README 文件
function readReadmeFile() {
  try {
    return fs.readFileSync(README_PATH, "utf8");
  } catch (error) {
    console.error("无法读取 README.md 文件:", error.message);
    process.exit(1);
  }
}

// 解析表格数据
function parseTableData(content) {
  const lines = content.split("\n");

  // 找到表格区域（在两个分隔符"---"之间）
  let tableStartLine = -1;
  let tableEndLine = -1;
  let separatorCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      separatorCount++;
      if (separatorCount === 1) {
        // 第一个分隔符后面是表格开始
        tableStartLine = i + 1;
      } else if (separatorCount === 2) {
        // 第二个分隔符前面是表格结束
        tableEndLine = i - 1;
        break;
      }
    }
  }

  if (tableStartLine === -1 || tableEndLine === -1) {
    console.error("无法找到表格区域，请确保README格式正确！");
    process.exit(1);
  }

  // 解析用户数据
  const users = [];
  const tableLines = [];

  for (let i = tableStartLine; i <= tableEndLine; i++) {
    if (
      lines[i].startsWith("|") &&
      lines[i].includes("|") &&
      lines[i].endsWith("|")
    ) {
      tableLines.push(i);
    }
  }

  for (const lineIndex of tableLines) {
    // 跳过表头和分隔行
    if (lineIndex === tableStartLine || lineIndex === tableStartLine + 1)
      continue;

    const line = lines[lineIndex];
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length >= 4) {
      const nickname = parts[1];
      const githubPattern = /\[(.*?)\]\((https:\/\/github\.com\/.*?)\)/;
      const githubMatch = parts[2].match(githubPattern);

      // 处理博客链接
      let blog = parts[3].trim();
      let blogUrl = "";
      const blogPattern = /\[(.*?)\]\((.*?)\)/;
      const blogMatch = parts[3].match(blogPattern);

      if (blogMatch) {
        blog = blogMatch[1];
        blogUrl = blogMatch[2];
      }

      if (githubMatch) {
        const username = githubMatch[1];
        const githubUrl = githubMatch[2];
        users.push({ nickname, username, githubUrl, blog, blogUrl });
      }
    }
  }

  return {
    users,
    tableStartLine,
    tableEndLine,
  };
}

// 添加新用户
async function addUser(
  users,
  username,
  providedNickname = "",
  blog = "",
  blogUrl = "",
) {
  // 检查用户是否已存在
  if (users.some((user) => user.username === username)) {
    console.log(`用户 ${username} 已存在!`);
    return false;
  }

  try {
    // 从GitHub API获取用户信息
    const userInfo = await fetchGitHubUserInfo(username);

    // 使用GitHub名称作为默认昵称（如果提供了昵称则使用提供的）
    const nickname = providedNickname.trim() || userInfo.name || username;

    // 添加新用户
    users.push({
      nickname,
      username,
      githubUrl: `https://github.com/${username}`,
      blog,
      blogUrl,
    });

    console.log(`成功添加用户 ${username}! GitHub昵称: ${nickname}`);
    return true;
  } catch (error) {
    console.error(error.message);

    // 如果API获取失败，使用提供的昵称或用户名
    if (
      providedNickname.trim() ||
      (await confirm(
        `无法获取GitHub信息，是否使用用户名 ${username} 作为昵称? (y/n): `,
      ))
    ) {
      const nickname = providedNickname.trim() || username;

      users.push({
        nickname,
        username,
        githubUrl: `https://github.com/${username}`,
        blog,
        blogUrl,
      });

      console.log(`已使用昵称 ${nickname} 添加用户 ${username}`);
      return true;
    }

    return false;
  }
}

// 确认提示
function confirm(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === "y");
    });
  });
}

// 生成新的表格内容
function generateNewTableContent(users) {
  let tableContent =
    "| 昵称 | GitHub | 博客 |\n| ---------- | ----------------------------------------------------- | |\n";

  for (const user of users) {
    let blogPart = user.blog;
    if (user.blog && user.blogUrl) {
      blogPart = `[${user.blog}](${user.blogUrl})`;
    }
    tableContent += `| ${user.nickname} | [${user.username}](${user.githubUrl}) | ${blogPart} |\n`;
  }

  return tableContent;
}

// 更新 README 文件
function updateReadmeFile(
  content,
  tableStartLine,
  tableEndLine,
  newTableContent,
) {
  const lines = content.split("\n");

  // 获取表格前后的内容
  const beforeTable = lines.slice(0, tableStartLine - 1); // 减1是为了保留第一个分隔符
  const afterTable = lines.slice(tableEndLine + 2); // 加2是为了保留第二个分隔符

  // 添加分隔符和表格
  const updatedContent = [
    ...beforeTable,
    "---",
    ...newTableContent.split("\n").slice(0, -1), // 去除末尾多余的换行符
    "---",
    ...afterTable,
  ].join("\n");

  // 写入文件
  try {
    fs.writeFileSync(README_PATH, updatedContent, "utf8");
    console.log("README.md 文件已更新!");
  } catch (error) {
    console.error("无法写入 README.md 文件:", error.message);
    process.exit(1);
  }
}

// 添加单个用户
async function addSingleUser(users) {
  try {
    const username = await new Promise((resolve) => {
      rl.question("请输入 GitHub 用户名: ", (answer) => resolve(answer.trim()));
    });

    if (!username) {
      console.log("用户名不能为空!");
      return askContinue(users);
    }

    // 获取GitHub信息前，先询问是否要自定义昵称
    const customNickname = await new Promise((resolve) => {
      rl.question("请输入自定义昵称 (直接回车使用GitHub昵称): ", (answer) =>
        resolve(answer.trim()),
      );
    });

    const blog = await new Promise((resolve) => {
      rl.question("请输入博客名称 (可选): ", (answer) =>
        resolve(answer.trim()),
      );
    });

    let blogUrl = "";
    if (blog) {
      blogUrl = await new Promise((resolve) => {
        rl.question("请输入博客链接 (可选): ", (answer) =>
          resolve(answer.trim()),
        );
      });
    }

    await addUser(users, username, customNickname, blog, blogUrl);
    await askContinue(users);
  } catch (error) {
    console.error(`添加用户出错: ${error.message}`);
    await askContinue(users);
  }
}

// 询问是否继续添加用户
async function askContinue(users) {
  const answer = await new Promise((resolve) => {
    rl.question("是否继续添加用户? (y/n): ", (ans) =>
      resolve(ans.toLowerCase()),
    );
  });

  if (answer === "y") {
    await addSingleUser(users);
  } else {
    const content = readReadmeFile();
    const { tableStartLine, tableEndLine } = parseTableData(content);
    // 不再排序，保持原有顺序加上新添加的用户
    const newTableContent = generateNewTableContent(users);
    updateReadmeFile(content, tableStartLine, tableEndLine, newTableContent);
    rl.close();
  }
}

// 批量添加用户
async function batchAddUsers(users) {
  const input = await new Promise((resolve) => {
    rl.question("请输入GitHub用户名列表(用逗号分隔): ", (ans) => resolve(ans));
  });

  const usernames = input.split(",").map((u) => u.trim());
  const addPromises = [];

  for (const username of usernames) {
    if (username) {
      addPromises.push(addUser(users, username));
    }
  }

  await Promise.all(addPromises);

  const content = readReadmeFile();
  const { tableStartLine, tableEndLine } = parseTableData(content);
  // 不再排序，保持原有顺序
  const newTableContent = generateNewTableContent(users);
  updateReadmeFile(content, tableStartLine, tableEndLine, newTableContent);

  console.log("批量添加完成");
  rl.close();
}

// 主函数
async function main() {
  const content = readReadmeFile();
  const { users } = parseTableData(content);

  console.log("=== zzuli-developers 用户添加工具 ===");
  console.log("现在将自动从GitHub获取用户昵称");

  const answer = await new Promise((resolve) => {
    rl.question("选择操作: 1.添加单个用户 2.批量添加用户 ", (ans) =>
      resolve(ans),
    );
  });

  if (answer === "1") {
    await addSingleUser(users);
  } else if (answer === "2") {
    await batchAddUsers(users);
  } else {
    console.log("无效选项，退出程序");
    rl.close();
  }
}

// 启动程序
main().catch((error) => {
  console.error(`程序运行出错: ${error.message}`);
  rl.close();
});
