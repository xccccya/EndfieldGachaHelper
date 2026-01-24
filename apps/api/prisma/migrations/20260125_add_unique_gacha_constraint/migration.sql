-- 添加唯一约束：确保同一个游戏账号的同一条抽卡记录（seqId + category）不会重复存储
-- 这可以防止因 recordUid 格式变化导致的重复数据

-- 首先删除重复的记录（保留最早创建的一条）
DELETE FROM `GachaRecord` 
WHERE id NOT IN (
    SELECT * FROM (
        SELECT MIN(id) 
        FROM `GachaRecord` 
        GROUP BY gameAccountId, seqId, category
    ) AS keep_records
);

-- 添加唯一约束
CREATE UNIQUE INDEX `GachaRecord_gameAccountId_seqId_category_key` ON `GachaRecord`(`gameAccountId`, `seqId`, `category`);
