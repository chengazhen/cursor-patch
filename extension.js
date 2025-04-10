const vscode = require("vscode");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const initSqlJs = require("sql.js");
const {
	extractUserIdFromJwt,
	getUsage,
	getFullStripeProfile,
	generateIds,
} = require("./utils/user");
const { updateMainJsContent } = require("./utils/mainjs");
const { name_lower, name_capitalize } = require("./utils/name");

let usageTimer = null; // 定时器变量
let statusBarItem = null; // 状态栏项

/**
 * 创建状态栏项
 */
function createStatusBarItem() {
	console.log("Creating status bar item...");
	if (statusBarItem) {
		console.log("Disposing old status bar item");
		statusBarItem.dispose();
	}
	
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		0 // 设置为最高优先级
	);
	statusBarItem.text = "$(key) Set Token";
	statusBarItem.tooltip = "点击设置 Cursor Token";
	statusBarItem.command = `fake-${name_lower}.setToken`;
	statusBarItem.show();
	console.log("Status bar item created and shown");
}

/**
 * 激活扩展时调用的方法
 * @param {vscode.ExtensionContext} context - VSCode扩展上下文
 */
function activate(context) {
	console.log(`Extension "fake-${name_lower}" is now active!`);
	console.log("Extension context:", context);

	// 确保状态栏可见
	vscode.commands.executeCommand('workbench.action.showStatusBar');

	// 创建状态栏项
	createStatusBarItem();
	context.subscriptions.push(statusBarItem);
	console.log("Status bar item added to subscriptions");

	// 监听窗口焦点变化，确保状态栏项始终显示
	context.subscriptions.push(
		vscode.window.onDidChangeWindowState(() => {
			console.log("Window state changed, recreating status bar item");
			createStatusBarItem();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			`fake-${name_lower}.regenerateId`,
			handleRegenerateId,
		),
		vscode.commands.registerCommand(
			`fake-${name_lower}.readToken`,
			handleReadToken,
		),
		vscode.commands.registerCommand(
			`fake-${name_lower}.setToken`,
			handleSetToken,
		),
		vscode.commands.registerCommand(
			`fake-${name_lower}.showUsage`,
			handleUsage,
		),
		vscode.commands.registerCommand(
			`fake-${name_lower}.patchMachineId`,
			handlePatchMachineId,
		),
	);

	// 设置定时器
	setupTimer(context);

	// 监听配置变化
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(`fake-${name_lower}.usageMonitor`)) {
				setupTimer(context);
			}
		}),
	);
}

const pathExists = async (path) => {
	try {
		await fs.access(path);
		return true;
	} catch {
		return false;
	}
};

/**
 * 验证存储文件和数据库路径
 * @param {string} storagePath - 存储文件路径
 * @param {string} dbPath - 数据库文件路径
 * @returns {Promise<{storagePath: string, dbPath: string}>} 返回验证后的路径
 */
async function validatePaths(storagePath, dbPath) {
	async function checkPaths(storage, db) {
		const storageExists = await pathExists(storage);
		const dbExists = await pathExists(db);

		if (!storageExists || !dbExists) {
			const missingFiles = [
				!storageExists && "storage.json",
				!dbExists && "state.vscdb",
			].filter(Boolean).join(" 和 ");
			throw new Error(`所选文件夹中缺少: ${missingFiles}`);
		}

		return { storagePath: storage, dbPath: db };
	}

	try {
		return await checkPaths(storagePath, dbPath);
	} catch (error) {
		const choice = await vscode.window.showInformationMessage(
			error.message,
			"手动选择文件夹",
		);

		if (choice !== "手动选择文件夹") {
			throw new Error("操作已取消");
		}

		const fileUri = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			title: "选择配置文件所在文件夹",
		});

		if (!fileUri?.length) {
			throw new Error("未选择文件夹");
		}

		const selectedDir = fileUri[0].fsPath;
		const newPaths = {
			storagePath: path.join(selectedDir, "storage.json"),
			dbPath: path.join(selectedDir, "state.vscdb"),
		};

		// 验证新选择的文件夹
		return await checkPaths(newPaths.storagePath, newPaths.dbPath);
	}
}

/**
 * 获取存储文件的路径
 * @returns {Promise<{storagePath: string, dbPath: string}>} 返回存储文件和数据库的路径
 */
async function getConfigPath() {
	const config = vscode.workspace.getConfiguration(`fake-${name_lower}`);
	const customPath = config.get("storagePath");

	const basePath = customPath || path.join(
		os.homedir(),
		...{
			"win32": ["AppData", "Roaming"],
			"darwin": ["Library", "Application Support"],
			"linux": [".config"],
		}[os.platform()] || (() => {
			throw new Error("不支持的操作系统");
		})(),
		name_capitalize,
		"User",
		"globalStorage",
	);

	return validatePaths(
		path.join(basePath, "storage.json"),
		path.join(basePath, "state.vscdb"),
	);
}

/**
 * 更新设备ID并创建备份
 * @param {string} storagePath - 存储文件路径
 * @param {string} dbPath - 数据库文件路径
 * @param {string} [accessToken] - 可选的访问令牌
 */
async function updateDeviceIds(storagePath, dbPath, accessToken) {
	let db = null;
	let result = "";
	let oldIds = {};
	let newIds = {};
	try {
		// 创建备份
		await Promise.all([
			fs.copyFile(storagePath, `${storagePath}.backup`).catch(() => {}),
			fs.copyFile(dbPath, `${dbPath}.backup`).catch(() => {}),
		]);
		
		// 生成新ID
		const userId = accessToken ? extractUserIdFromJwt(accessToken) : "";
		newIds = generateIds(userId);

		try {
			// 写入 devDeviceId 到 machineid 文件
			const machineIdPath = path.join(
				path.dirname(path.dirname(path.dirname(storagePath))),
				"machineid",
			);
			await fs.writeFile(machineIdPath, newIds.devDeviceId, "utf8");
		} catch {
			// 忽略任何路径计算或写入过程中的错误
			console.log("写入 machineid 文件失败, 继续执行...");
		}

		// 更新JSON配置
		const jsonConfig = JSON.parse(await fs.readFile(storagePath, "utf8"));
		oldIds = Object.fromEntries(
			Object.keys(newIds).map(
				(key) => [key, jsonConfig[`telemetry.${key}`] || "无"],
			),
		);
		Object.entries(newIds).forEach(([key, value]) => {
			jsonConfig[`telemetry.${key}`] = value;
		});
		await fs.writeFile(storagePath, JSON.stringify(jsonConfig, null, 2));

		// 更新数据库
		const SQL = await initSqlJs();
		const dbBuffer = await fs.readFile(dbPath);
		db = new SQL.Database(dbBuffer);

		// 更新设备ID
		db.run("UPDATE ItemTable SET value = ? WHERE key = ?", [
			newIds.devDeviceId,
			"storage.serviceMachineId",
		]);

		// 处理认证信息和会员类型
		const updates = [
			[`${name_lower}Auth/accessToken`, accessToken || ""],
			[`${name_lower}Auth/refreshToken`, accessToken || ""],
			[
				`${name_lower}Auth/cachedEmail`,
				accessToken ? (userId || `admin@${name_lower}.sh`) : "",
			],
			[`${name_lower}Auth/cachedSignUpType`, accessToken ? "Auth_0" : ""],
			[`${name_lower}Auth/stripeMembershipType`, accessToken ? "pro" : "free"],
		];

		updates.forEach(([key, value]) => {
            const exists = db.exec(`SELECT 1 FROM ItemTable WHERE key = ?`, [key]);
            if (exists.length === 0) {
                db.run("INSERT INTO ItemTable (key, value) VALUES (?, ?)", [key, value]);
            } else {
                db.run("UPDATE ItemTable SET value = ? WHERE key = ?", [value, key]);
            }
        });

		// 保存数据库文件
		const data = db.export();
		await fs.writeFile(dbPath, Buffer.from(data));

		result += accessToken
			? "✅ 数据库更新成功\n✅ Token已更新\n✅ 会员类型已设置为 pro"
			: "✅ 数据库更新成功\n✅ 认证信息已清空\n✅ 会员类型已设置为 free";
	} catch (error) {
		console.error("更新失败:", error);
		result += "❌ 更新失败: " + error.message;
	} finally {
		if (db) db.close();
		// 显示结果并退出
		await vscode.window.showInformationMessage(
			Object.entries(newIds)
				.map(([key, value]) =>
					`${key}:\n旧: ${oldIds[key]}\n新: ${value}`
				)
				.join("\n\n") +
				"\n\n数据库状态:\n" + result +
				`\n\n✅ 操作已完成, ${name_capitalize} 将立即退出`,
			{ modal: true },
		).then(() => {
			// 使用 process.exit() 强制退出
			vscode.commands.executeCommand("workbench.action.quit").then(() => {
				setTimeout(() => process.exit(0), 100);
			});
		});
	}
}

/**
 * 从数据库获取 token
 * @returns {Promise<string>} token
 * @throws {Error} 当未找到 token 或数据库操作失败时
 */
async function getTokenFromDb() {
	const paths = await getConfigPath();
	const SQL = await initSqlJs();
	const dbBuffer = await fs.readFile(paths.dbPath);
	const db = new SQL.Database(dbBuffer);

	try {
		const result = db.exec(
			`SELECT value FROM ItemTable WHERE key = "${name_lower}Auth/accessToken"`,
		);
		if (
			!result.length || !result[0].values.length ||
			!result[0].values[0][0]
		) {
			throw new Error("未找到 Access Token");
		}
		return result[0].values[0][0];
	} finally {
		db.close();
	}
}

/**
 * 设置定时器
 */
function setupTimer(context) {
	const config = vscode.workspace.getConfiguration(
		`fake-${name_lower}.usageMonitor`,
	);
	const interval = Math.floor(config.get("checkInterval") ?? 0);
	const remainingLimit = Math.floor(
		config.get("usageRemainingThreshold") ?? 0,
	);
	const usageLimit = Math.floor(config.get("usageCountThreshold") ?? 0);

	// 如果间隔小于20秒或未设置，不启动定时器, 限制间隔在20秒到24小时之间
	if (interval < 20) return;
	const validInterval = Math.max(20, Math.min(1440 * 60, interval)) * 1000;

	if (usageTimer) clearInterval(usageTimer);

	let isRunning = false;
	usageTimer = setInterval(async () => {
		if (isRunning) return;
		isRunning = true;
		try {
			const token = await getTokenFromDb();
			const usage = await getUsage(token);
			const remaining = usage.max_premium_usage - usage.premium_usage;

			const alerts = [];
			if (remainingLimit > 0 && remaining <= remainingLimit) {
				alerts.push(`剩余次数不足 ${remaining} 次`);
			}
			if (usageLimit > 0 && usage.premium_usage >= usageLimit) {
				alerts.push(`已使用 ${usage.premium_usage} 次`);
			}

			if (alerts.length > 0) {
				vscode.window.showWarningMessage(
					`fake-${name_lower}: ${alerts.join(", ")}`,
				);
				await handleUsage();
			}
		} catch (err) {
			console.error("Timer check failed:", err);
		} finally {
			isRunning = false;
		}
	}, validInterval);

	context.subscriptions.push({
		dispose: () => {
			if (usageTimer) {
				clearInterval(usageTimer);
				usageTimer = null;
			}
		},
	});
}

/**
 * 处理重新生成设备ID的命令
 */
async function handleRegenerateId() {
	try {
		const confirm = await vscode.window.showWarningMessage(
			"此操作将重新生成设备ID并清空认证信息, 是否继续？",
			{
				modal: true,
				detail: "将会备份原有配置文件, 但建议手动备份以防万一. ",
			},
			"继续",
			"取消",
		);

		if (confirm !== "继续") {
			console.log("操作已取消");
			return;
		}

		const paths = await getConfigPath();
		await updateDeviceIds(paths.storagePath, paths.dbPath);
	} catch (error) {
		vscode.window.showErrorMessage(`操作失败: ${error.message}`);
		console.error("详细错误:", error);
	}
}

/**
 * 处理获取Token的命令
 */
async function handleReadToken() {
	try {
		const token = await getTokenFromDb();
		vscode.window.showInformationMessage(`Access Token: ${token}`);
	} catch (error) {
		vscode.window.showErrorMessage(`操作失败: ${error.message}`);
		console.error("详细错误:", error);
	}
}

/**
 * 处理设置Token的命令
 */
async function handleSetToken(token) {
	try {
		if (!token) {
			token = await vscode.window.showInputBox({
				prompt: "请输入 Access Token",
				password: true,
				placeHolder: "输入 Access Token",
			});
		}

		if (!token) {
			console.log("操作已取消");
			return;
		}
		const confirm = await vscode.window.showWarningMessage(
			"此操作将重新生成设备ID并设置新的Token, 是否继续？",
			{
				modal: true,
				detail: "将会备份原有配置文件, 但建议手动备份以防万一. ",
			},
			"继续",
			"取消",
		);

		if (confirm !== "继续") {
			console.log("操作已取消");
			return;
		}

		const paths = await getConfigPath();
		await updateDeviceIds(paths.storagePath, paths.dbPath, token);
	} catch (error) {
		vscode.window.showErrorMessage(`操作失败: ${error.message}`);
		console.error("详细错误:", error);
	}
}

/**
 * 处理使用情况
 */
async function handleUsage() {
	try {
		let result = "";
		const token = await getTokenFromDb();
		const usage = await getUsage(token);
		result +=
			`Premium Usage: ${usage.premium_usage}/${usage.max_premium_usage}; \n`;
		result +=
			`Basic Usage: ${usage.basic_usage}/${usage.max_basic_usage}; \n`;

		// 获取完整的 Stripe 用户信息
		const profile = await getFullStripeProfile(token);
		result += `Membership Type: ${profile.membershipType}; \n`;
		result +=
			`Days Remaining on Trial: ${profile.daysRemainingOnTrial}; \n`;

		// 显示信息
		// vscode.window.showInformationMessage(result, { modal: true }); // 弹窗, 但不好看
		vscode.window.showInformationMessage(result); // 无感 Message, 舒服
		console.log(result);
	} catch (error) {
		vscode.window.showErrorMessage(`获取使用情况时出错: ${error.message}`);
		console.error("获取使用情况时出错:", error);
	}
}

/**
 * 修补机器码获取逻辑
 */
async function handlePatchMachineId() {
	try {
		const confirm = await vscode.window.showWarningMessage(
			`即将修补 ${name_capitalize} 机器码获取逻辑`,
			{
				modal: true,
				detail: `功能: 修补 ${name_capitalize} 0.45.x 版本机器码的获取方式\n\n` +
					`⚠️ 注意事项:\n` +
					`  1. 此操作将修补 ${name_capitalize} 的 main.js 文件, 仅需执行一次\n` +
					`  2. 修补后需要重启 ${name_capitalize} 才能生效\n` +
					`  3. 操作不可逆，建议提前备份文件\n` +
					`  4. 直接覆盖安装可恢复\n` +
					`  5. 升级后需要再次执行\n` +
					`\n确认要继续吗? `,
			},
			"继续修补",
		);

		if (confirm !== "继续修补") {
			return;
		}

		const config = vscode.workspace.getConfiguration(`fake-${name_lower}`);
		const customPath = config.get("mainJsPath");

		let filePath;
		if (!customPath) {
			const platform = os.platform();
			if (platform === "linux") {
				throw new Error("Linux 系统不支持修补 main.js");
			}

			filePath = platform === "darwin"
				? `/Applications/${name_capitalize}.app/Contents/Resources/app/out/main.js`
				: path.join(
					os.homedir(),
					"AppData",
					"Local",
					"Programs",
					name_lower,
					"resources",
					"app",
					"out",
					"main.js",
				);
		} else {
			filePath = customPath;
		}

		if (!await pathExists(filePath)) {
			const choice = await vscode.window.showInformationMessage(
				"未找到 main.js 文件",
				"手动选择文件",
			);

			if (choice !== "手动选择文件") {
				throw new Error("操作已取消");
			}

			const fileUri = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: {
					"JavaScript": ["js"],
				},
				title: "选择 main.js 文件",
			});

			if (!fileUri?.length) {
				throw new Error("未选择文件");
			}

			filePath = fileUri[0].fsPath;
		}

		await updateMainJsContent(filePath);

		await vscode.window.showInformationMessage(
			`✅ main.js 修补成功，${name_capitalize} 将立即退出`,
			{ modal: true }
		).then(() => {
			vscode.commands.executeCommand('workbench.action.quit').then(() => {
				setTimeout(() => process.exit(0), 100);
			});
		});

	} catch (error) {
		vscode.window.showErrorMessage(`修补 main.js 失败: ${error.message}`);
		console.error("详细错误:", error);
	}
}

function deactivate() {
	if (usageTimer) {
		clearInterval(usageTimer);
		usageTimer = null;
	}
}

module.exports = { activate, deactivate };
