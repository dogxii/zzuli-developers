#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// 配置文件路径
const README_PATH = path.join(__dirname, "README.md");

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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
function addUser(users, nickname, username, blog = "", blogUrl = "") {
  // 检查用户是否已存在
  if (users.some((user) => user.username === username)) {
    console.log(`用户 ${username} 已存在!`);
    return false;
  }

  // 添加新用户
  users.push({
    nickname,
    username,
    githubUrl: `https://github.com/${username}`,
    blog,
    blogUrl,
  });

  console.log(`成功添加用户 ${username}!`);
  return true;
}

// 按照昵称字母顺序排序
function sortUsersByNickname(users) {
  return users.sort((a, b) => {
    return a.nickname.localeCompare(b.nickname, "zh-CN");
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
    tableContent += `| ${user.nickname} | [${user.username}](${user.githubUrl}) |${blogPart}|\n`;
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
function addSingleUser(users) {
  rl.question("请输入 GitHub 用户名: ", (username) => {
    rl.question("请输入昵称 (直接回车使用用户名作为昵称): ", (nickname) => {
      if (!nickname.trim()) {
        nickname = username;
      }

      rl.question("请输入博客名称 (可选): ", (blog) => {
        if (blog.trim()) {
          rl.question("请输入博客链接 (可选): ", (blogUrl) => {
            addUser(users, nickname, username, blog, blogUrl);
            askContinue(users);
          });
        } else {
          addUser(users, nickname, username);
          askContinue(users);
        }
      });
    });
  });
}

// 询问是否继续添加用户
function askContinue(users) {
  rl.question("是否继续添加用户? (y/n): ", (answer) => {
    if (answer.toLowerCase() === "y") {
      addSingleUser(users);
    } else {
      const content = readReadmeFile();
      const { tableStartLine, tableEndLine } = parseTableData(content);
      const sortedUsers = sortUsersByNickname(users);
      const newTableContent = generateNewTableContent(sortedUsers);
      updateReadmeFile(content, tableStartLine, tableEndLine, newTableContent);
      rl.close();
    }
  });
}

// 批量添加用户
function batchAddUsers(users) {
  rl.question("请输入GitHub用户名列表(用逗号分隔): ", (input) => {
    const usernames = input.split(",").map((u) => u.trim());

    for (const username of usernames) {
      if (username) {
        addUser(users, username, username);
      }
    }

    const content = readReadmeFile();
    const { tableStartLine, tableEndLine } = parseTableData(content);
    const sortedUsers = sortUsersByNickname(users);
    const newTableContent = generateNewTableContent(sortedUsers);
    updateReadmeFile(content, tableStartLine, tableEndLine, newTableContent);

    console.log("批量添加完成");
    rl.close();
  });
}

// 主函数
function main() {
  const content = readReadmeFile();
  const { users } = parseTableData(content);

  console.log("=== zzuli-developers 用户添加工具 ===");
  rl.question("选择操作: 1.添加单个用户 2.批量添加用户 ", (answer) => {
    if (answer === "1") {
      addSingleUser(users);
    } else if (answer === "2") {
      batchAddUsers(users);
    } else {
      console.log("无效选项，退出程序");
      rl.close();
    }
  });
}

main();
