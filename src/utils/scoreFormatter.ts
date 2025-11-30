/**
 * 格式化积分为"万"单位显示
 * @param score 原始积分
 * @returns 格式化后的字符串，如 "50万"、"30.69万"
 */
export function formatScore(score: number): string {
	if (!score) return '0'

	const wan = score / 10000
	if (wan >= 100) {
		return wan.toFixed(0) + '万'
	} else if (wan >= 10) {
		return wan.toFixed(1) + '万'
	} else if (wan >= 1) {
		return wan.toFixed(2) + '万'
	} else {
		// 小于 1 万的积分，同样用“万”为单位展示
		return wan.toFixed(2) + '万'
	}
}
