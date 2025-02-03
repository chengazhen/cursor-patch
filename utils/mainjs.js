const fs = require("fs").promises;
const crypto = require("crypto");
const { name_lower, name_capitalize } = require("./name.js");

// 支持的版本的md5
const mainJsMd5 = {
    "1f53d40367d0ac76f3f123c83b901497": ["0.45.2~0.45.8"],
    "6114002d8e2bb53853f4a49e228e8c74": ["0.45.2"],
    "fde15c3fe02b6c48a2a8fa788ff3ed2a": ["0.45.3"],
    "0052f48978fa8e322e2cb7e0c101d6b2": ["0.45.4"],
    "74ed1a381f4621ccfd35989f322dc8a2": ["0.45.5"],
    "e82b270f8c114247968bb4a04a4f4f72": ["0.45.7"],
    "352c7f017a7eab95690263a9d83b7832": ["0.45.8"],
};

async function calculateMd5WithoutLastLines(
    sourceFilePath,
    lineCountToRemove = 5,
) {
    try {
        const fileContent = await fs.readFile(sourceFilePath, "utf8");
        const contentLines = fileContent.split("\n");

        // 如果文件行数少于指定行数，直接计算整个文件的 md5
        const content = contentLines.length < lineCountToRemove
            ? fileContent
            : contentLines.slice(0, -lineCountToRemove).join("\n");

        return crypto.createHash("md5").update(content).digest("hex");
    } catch (err) {
        throw new Error(`计算 main.js md5失败: ${err.message}`);
    }
}

/**
 * 修补 main.js 文件内容
 * @param {string} filePath - main.js 文件路径
 */
async function updateMainJsContent(filePath) {
    const md5 = await calculateMd5WithoutLastLines(filePath);

    if (!mainJsMd5[md5]) {
        const versions = Object.values(mainJsMd5).flat().join(", ");
        throw new Error(
            `不支持的 ${name_capitalize} 版本或 main.js 已被修补。\n支持的版本: ${versions}`,
        );

    }

    let content = await fs.readFile(filePath, "utf8");
    await fs.writeFile(`${filePath}.backup`, content); // 创建备份

    [
        [
            /async\s+(\w+)\s*\(\)\s*{\s*return\s+this\.[\w.]+\?\?\s*this\.([\w.]+)\.machineId\s*}/g,
            (_, fname, prop) =>
                `async ${fname}() { return this.${prop}.machineId }`,
        ],
        [
            /async\s+(\w+)\s*\(\)\s*{\s*return\s+this\.[\w.]+\?\?\s*this\.([\w.]+)\.macMachineId\s*}/g,
            (_, fname, prop) =>
                `async ${fname}() { return this.${prop}.macMachineId }`,
        ],
    ].forEach(([pattern, replacer]) => {
        content = content.replace(pattern, replacer);
    });

    await fs.writeFile(filePath, content);
}

module.exports = {
    updateMainJsContent,
};
