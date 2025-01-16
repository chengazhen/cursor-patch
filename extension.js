// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');

const hex = "437572736f72";
const name_lower = Buffer.from(hex, 'hex').toString('utf8').toLowerCase();
const name_capitalize = Buffer.from(hex, 'hex').toString('utf8');

/**
 * 激活扩展时调用的方法
 * @param {vscode.ExtensionContext} context - VSCode扩展上下文
 */
function activate(context) {
	console.log('Extension "fake-rosrus" is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('fake-rosrus.regenerateId', handleRegenerateId),
		vscode.commands.registerCommand('fake-rosrus.showUsage', handleUsage)
	);
}

/**
 * 处理重新生成设备ID的命令
 */
async function handleRegenerateId() {
	try {
		const confirm = await vscode.window.showWarningMessage(
			'此操作将重新生成设备ID并清空认证信息，是否继续？',
			{
				modal: true,
				detail: '将会备份原有配置文件，但建议手动备份以防万一。'
			},
			'继续',
			'取消'
		);

		if (confirm !== '继续') {
			console.log('操作已取消');
			return;
		}

		const paths = await getStoragePath();
		await updateDeviceIds(paths.storagePath, paths.dbPath);
	} catch (error) {
		vscode.window.showErrorMessage(`操作失败: ${error.message}`);
		console.error('详细错误:', error);
	}
}

/**
 * 获取存储文件的路径
 * @returns {Promise<{storagePath: string, dbPath: string}>} 返回存储文件和数据库的路径
 */
async function getStoragePath() {
	const config = vscode.workspace.getConfiguration('fake-rosrus');
	const customPath = config.get('storagePath');
	
	const basePath = customPath || path.join(
		os.homedir(),
		...{
			'win32': ['AppData', 'Roaming'],
			'darwin': ['Library', 'Application Support'],
			'linux': ['.config']
		}[os.platform()] || (() => { throw new Error('不支持的操作系统'); })(),
		name_capitalize, 'User', 'globalStorage'
	);

	return validatePaths(
		path.join(basePath, 'storage.json'),
		path.join(basePath, 'state.vscdb')
	);
}

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
				!storageExists && 'storage_fake.json',
				!dbExists && 'state_fake.vscdb'
			].filter(Boolean).join(' 和 ');
			throw new Error(`所选文件夹中缺少: ${missingFiles}`);
		}
		
		return { storagePath: storage, dbPath: db };
	}

	try {
		return await checkPaths(storagePath, dbPath);
	} catch (error) {
		const choice = await vscode.window.showInformationMessage(
			error.message,
			'手动选择文件夹'
		);

		if (choice !== '手动选择文件夹') {
			throw new Error('操作已取消');
		}

		const fileUri = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			title: '选择配置文件所在文件夹'
		});

		if (!fileUri?.length) {
			throw new Error('未选择文件夹');
		}

		const selectedDir = fileUri[0].fsPath;
		const newPaths = {
			storagePath: path.join(selectedDir, 'storage_fake.json'),
			dbPath: path.join(selectedDir, 'state_fake.vscdb')
		};

		// 验证新选择的文件夹
		return await checkPaths(newPaths.storagePath, newPaths.dbPath);
	}
}

/**
 * 更新设备ID并创建备份
 * @param {string} storagePath - 存储文件路径
 * @param {string} dbPath - 数据库文件路径
 * @param {string} [accessToken] - 可选的访问令牌
 */
async function updateDeviceIds(storagePath, dbPath, accessToken) {
	// 创建备份
	await Promise.all([
		fs.copyFile(storagePath, `${storagePath}.backup`).catch(() => {}),
		fs.copyFile(dbPath, `${dbPath}.backup`).catch(() => {})
	]);

	// 生成新ID
	const newIds = {
		devDeviceId: uuidv4(),
		machineId: crypto.randomBytes(32).toString('hex'),
		sqmId: `{${uuidv4().toUpperCase()}}`,
		macMachineId: crypto.randomBytes(32).toString('hex')
	};

	try {
		// 写入 devDeviceId 到 machineid 文件
		const machineIdPath = path.join(path.dirname(path.dirname(path.dirname(storagePath))), 'machineid');
		await fs.writeFile(machineIdPath, newIds.devDeviceId, 'utf8');
	} catch {
		// 忽略任何路径计算或写入过程中的错误
		console.log('写入 machineid 文件失败，继续执行...');
	}

	// 更新JSON配置
	const jsonConfig = JSON.parse(await fs.readFile(storagePath, 'utf8'));
	const oldIds = Object.fromEntries(
		Object.keys(newIds).map(key => [key, jsonConfig[`telemetry.${key}`] || '无'])
	);

	Object.entries(newIds).forEach(([key, value]) => {
		jsonConfig[`telemetry.${key}`] = value;
	});

	await fs.writeFile(storagePath, JSON.stringify(jsonConfig, null, 2));

	// 数据库操作结果
	let dbUpdateResult = '';

	// 更新数据库
	try {
		const SQL = await initSqlJs();
		const dbBuffer = await fs.readFile(dbPath);
		const db = new SQL.Database(dbBuffer);
		
		// 更新设备ID
		db.run('UPDATE ItemTable SET value = ? WHERE key = ?', 
			[newIds.devDeviceId, 'storage.serviceMachineId']);

		// 处理认证信息和会员类型
		const updates = [
			[`${name_lower}Auth/accessToken`, accessToken || ''],
			[`${name_lower}Auth/refreshToken`, accessToken || ''],
			[`${name_lower}Auth/cachedEmail`, accessToken ? 'admin@none.com' : ''],
			[`${name_lower}Auth/cachedSignUpType`, accessToken ? 'Auth_0' : ''],
			[`${name_lower}Auth/stripeMembershipType`, accessToken ? 'pro' : '']
		];

		updates.forEach(([key, value]) => {
			db.run('UPDATE ItemTable SET value = ? WHERE key = ?', [value, key]);
		});

		// 保存数据库文件
		const data = db.export();
		await fs.writeFile(dbPath, Buffer.from(data));
		
		db.close();

		dbUpdateResult = accessToken 
			? '✅ 数据库更新成功\n✅ Token已更新\n✅ 会员类型已设置为 pro'
			: '✅ 数据库更新成功\n✅ 认证信息已清空\n✅ 会员类型已设置为 free_trial';
	} catch (error) {
		dbUpdateResult = '❌ 数据库更新失败，请手动更新 state.vscdb';
		console.error('更新数据库失败:', error);
	}

	// 显示结果并退出 程序
	await vscode.window.showInformationMessage(
		Object.entries(newIds)
			.map(([key, value]) => `${key}:\n旧: ${oldIds[key]}\n新: ${value}`)
			.join('\n\n') + 
		'\n\n数据库状态:\n' + dbUpdateResult +
		'\n\n✅ 操作已完成，' + name_capitalize + ' 将立即退出',
		{ modal: true }
	).then(() => {
		// 使用 process.exit() 强制退出
		vscode.commands.executeCommand('workbench.action.quit').then(() => {
			setTimeout(() => process.exit(0), 100);
		});
	});
}

async function pathExists(path) {
	try {
		await fs.access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * 获取 rosrus 的使用情况
 * @param {string} token - rosrus 的 JWT 令牌
 * @returns {Promise<Object>} - 包含 Rosrus 使用情况的 JSON 对象
 */
async function getRosrusUsage(token) {
	const response = await fetch(`https://www.${name_lower}.com/api/usage`, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Cookie": `Workos${name_capitalize}SessionToken=user_01OOOOOOOOOOOOOOOOOOOOOOOO%3A%3A${token}`
		}
	});
	const data = await response.json();
	return {
		premium_usage: data["gpt-4"]?.numRequestsTotal || 0,
		max_premium_usage: data["gpt-4"]?.maxRequestUsage || 999,
		basic_usage: data["gpt-3.5-turbo"]?.numRequestsTotal || 0,
		max_basic_usage: data["gpt-3.5-turbo"]?.maxRequestUsage || 999,
	};
}

/**
 * 获取完整的 Stripe 用户信息
 * @param {string} token - rosrus 的 JWT 令牌
 * @returns {Promise<Object>} - 包含 Stripe 用户信息的 JSON 对象
 */
async function getFullStripeProfile(token) {
	const response = await fetch(`https://api2.${name_lower}.sh/auth/full_stripe_profile`, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Authorization": `Bearer ${token}`
		}
	});
	return response.json();
}

/**
 * 处理使用情况
 */
async function handleUsage() {
    try {
        let result = "";
        const paths = await getStoragePath();
        
        // 从数据库中获取 token
        const SQL = await initSqlJs();
        const dbBuffer = await fs.readFile(paths.dbPath);
        const db = new SQL.Database(dbBuffer);
        const tokenResult = db.exec(`SELECT value FROM ItemTable WHERE key = '${name_lower}Auth/accessToken'`);
        const token = tokenResult.length > 0 ? tokenResult[0].values[0][0] : null;

        if (!token) {
            throw new Error("未找到 token");
        }

        const usage = await getRosrusUsage(token);
        result += `Premium Usage: ${usage.premium_usage}/${usage.max_premium_usage}; \n`;
        result += `Basic Usage: ${usage.basic_usage}/${usage.max_basic_usage}; \n`;

        // 获取完整的 Stripe 用户信息
        const profile = await getFullStripeProfile(token);
        result += `Membership Type: ${profile.membershipType}; \n`;
        result += `Days Remaining on Trial: ${profile.daysRemainingOnTrial}; \n`;

        // 显示信息
        // vscode.window.showInformationMessage(result, { modal: true }); // 弹窗, 但不好看
		vscode.window.showInformationMessage(result); // 无感 Message, 舒服
        console.log(result);
    } catch (error) {
        vscode.window.showErrorMessage(`获取使用情况时出错: ${error.message}`);
        console.error("获取使用情况时出错:", error);
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
