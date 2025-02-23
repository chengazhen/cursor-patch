const fs = require("fs").promises;
const crypto = require("crypto");
const { name_lower, name_capitalize } = require("./name.js");
const fetch = require('node-fetch');
const vscode = require("vscode");

// 支持的版本的md5
const mainJsMd5_Local = {
    "1f53d40367d0ac76f3f123c83b901497": ["0.45.2~0.45.8[-5]", "0.45.11[-5]"],
    "1650464dc26313c87c789da60c0495d0": ["0.45.10[-5]"],
    "723d492726d0cfa5ac2ad0649f499ef5": ["0.45.15[-5]"],
    "2df7e08131902951452d37fe946b8b8c": ["0.46.0[-5]"],
    "44fd6c68052686e67c0402f69ae3f1bb": ["0.46.2[-5]"],
    "6114002d8e2bb53853f4a49e228e8c74": ["0.45.2"],
    "fde15c3fe02b6c48a2a8fa788ff3ed2a": ["0.45.3"],
    "0052f48978fa8e322e2cb7e0c101d6b2": ["0.45.4"],
    "74ed1a381f4621ccfd35989f322dc8a2": ["0.45.5"],
    "e82b270f8c114247968bb4a04a4f4f72": ["0.45.7"],
    "352c7f017a7eab95690263a9d83b7832": ["0.45.8"],
    "217d4ae5933b13b9aae1829750d0b709": ["0.45.10"],
    "76bddc6605df5d845af68d4959a4f045": ["0.45.15"],
    "a6d83fa177878ff497286d659957d9ab": ["0.46.0"],
    "95277d19fe0bb4eb8bbb236d5386cd46": ["0.46.2"]
};

async function getMainJsMd5() {
    const originalUrl = "https://gist.githubusercontent.com/Angels-Ray/11a0c8990750f4f563292a55c42465f1/raw";
    
    async function tryFetch(url) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error(`获取MD5列表失败 ${url}:`, error);
        }
        return null;
    }

    return await tryFetch(originalUrl) || 
        await tryFetch("https://gh-proxy.com/" + originalUrl) || 
        mainJsMd5_Local;
}

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
    const mainJsMd5 = await getMainJsMd5();

    if (!mainJsMd5[md5]) {
        const versions = Object.values(mainJsMd5).flat().join(", ");
        const message = `当前 main.js 的版本可能未被支持, 或已修补过\n\n已支持的版本: ${versions}\n\n是否仍要继续修补？`;
        
        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            "继续修补",
        );

        if (choice !== "继续修补") {
            throw new Error("操作已取消");
        }
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
