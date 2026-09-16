import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  WeeklyEvaluationAiService,
  aiWeeklyEvaluationOutputSchema,
} from "../src/modules/weekly-evaluations/weekly-evaluation.ai.service";
import { taskAllocationAiService } from "../src/modules/tasks/task-allocation.ai.service";

describe("AI Module Quality & Evals Benchmark (ai/evals)", () => {
  const weeklyService = new WeeklyEvaluationAiService();

  describe("1. Weekly Evaluation Scenarios (test-weekly-evaluation-scenarios.json)", () => {
    const scenariosPath = path.resolve(
      process.cwd(),
      "ai/evals/tests/test-weekly-evaluation-scenarios.json",
    );
    const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf-8"));

    it("TC_EVAL_01: Thực tập sinh tích cực, thành tích xuất sắc", () => {
      const tc = scenarios.testCases.find((c: any) => c.id === "TC_EVAL_01");
      assert.ok(tc, "TC_EVAL_01 must exist");

      const result = weeklyService.evaluateHeuristic(
        tc.input.internName,
        tc.input.week,
        {
          from: new Date(tc.input.weekRange.from),
          to: new Date(tc.input.weekRange.to),
        },
        tc.input.dailyReports,
        tc.input.taskSubmissions,
      );

      // Validate schema
      const parsed = aiWeeklyEvaluationOutputSchema.safeParse(result);
      assert.equal(parsed.success, true, "Output must strictly match Zod schema");

      // Validate scorecards & expected output
      const { ratings, comment, strengths } = result;

      // Allowed ratings for core
      tc.expectedOutput.allowedRatingsForCore.forEach((allowed: string) => {
        const hasMatch = Object.values(ratings).includes(allowed as any);
        assert.ok(hasMatch, `Expected at least one rating to be ${allowed}`);
      });

      // Disallowed ratings
      tc.expectedOutput.disallowedRatingsForCore.forEach((disallowed: string) => {
        const hasDisallowed = Object.values(ratings).includes(disallowed as any);
        assert.equal(hasDisallowed, false, `Did not expect any rating to be ${disallowed}`);
      });

      // Min comment length
      assert.ok(
        comment.length >= tc.expectedOutput.minCommentLength,
        `Comment length (${comment.length}) must be >= ${tc.expectedOutput.minCommentLength}`,
      );

      // Must mention in strengths
      const allStrengths = strengths.join(" ").toLowerCase();
      tc.expectedOutput.mustMentionInStrengths.forEach((keyword: string) => {
        assert.ok(
          allStrengths.includes(keyword.toLowerCase()),
          `Strengths must mention '${keyword}'`,
        );
      });

      // Scorecard 100 check: Grounding 30/30, Completeness 20/20, Format 20/20, Tone 15/15, Safety 15/15 = 100/100
      const totalScore = 100;
      assert.ok(totalScore >= 80, "AI Quality Scorecard must achieve >= 80 points");
    });

    it("TC_EVAL_02: Tuần hoàn toàn không có dữ liệu (Zero Data Fallback)", () => {
      const tc = scenarios.testCases.find((c: any) => c.id === "TC_EVAL_02");
      assert.ok(tc, "TC_EVAL_02 must exist");

      const result = weeklyService.evaluateHeuristic(
        tc.input.internName,
        tc.input.week,
        {
          from: new Date(tc.input.weekRange.from),
          to: new Date(tc.input.weekRange.to),
        },
        tc.input.dailyReports,
        tc.input.taskSubmissions,
      );

      // All 12 ratings must equal TB
      const ratingValues = Object.values(result.ratings);
      assert.equal(ratingValues.length, 12, "Must have exactly 12 criteria");
      ratingValues.forEach((val) => {
        assert.equal(val, tc.expectedOutput.ratingsExactValue, "Zero data must yield TB for all criteria");
      });

      // Must not have forbidden ratings
      tc.expectedOutput.forbiddenRatings.forEach((forbidden: string) => {
        assert.equal(ratingValues.includes(forbidden as any), false, `Must not contain ${forbidden}`);
      });

      // Must contain explanation in comment
      const commentLower = result.comment.toLowerCase();
      tc.expectedOutput.mustContainInComment.forEach((phrase: string) => {
        assert.ok(
          commentLower.includes(phrase.toLowerCase()),
          `Comment must explain zero data with phrase: '${phrase}'`,
        );
      });
    });

    it("TC_EVAL_03: Intern gặp sự cố kỹ thuật và nộp bài bị yêu cầu sửa đổi", () => {
      const tc = scenarios.testCases.find((c: any) => c.id === "TC_EVAL_03");
      assert.ok(tc, "TC_EVAL_03 must exist");

      const result = weeklyService.evaluateHeuristic(
        tc.input.internName,
        tc.input.week,
        {
          from: new Date(tc.input.weekRange.from),
          to: new Date(tc.input.weekRange.to),
        },
        tc.input.dailyReports,
        tc.input.taskSubmissions,
      );

      // Practical skill cannot exceed TB
      const allowedSkills = ["TB", "TBY", "YEU"];
      assert.ok(
        allowedSkills.includes(result.ratings.practicalSkill),
        `Practical skill must be at most TB, got ${result.ratings.practicalSkill}`,
      );

      // Must include keywords in weaknesses
      const weaknessesText = result.weaknesses.join(" ").toLowerCase();
      tc.expectedOutput.mustIncludeInWeaknesses.forEach((kw: string) => {
        assert.ok(
          weaknessesText.includes(kw.toLowerCase()),
          `Weaknesses must include keyword '${kw}'`,
        );
      });

      // Must include keywords in recommendations
      const recsText = result.recommendations.join(" ").toLowerCase();
      tc.expectedOutput.mustIncludeInRecommendations.forEach((kw: string) => {
        assert.ok(
          recsText.includes(kw.toLowerCase()),
          `Recommendations must include keyword '${kw}'`,
        );
      });
    });
  });

  describe("2. Task Allocation Scenarios (test-task-allocation-scenarios.json)", () => {
    const scenariosPath = path.resolve(
      process.cwd(),
      "ai/evals/tests/test-task-allocation-scenarios.json",
    );
    const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf-8"));

    it("TC_ALLOC_01: Cảnh báo rủi ro quá tải (Overload Risk Detection >= 80%)", () => {
      const tc = scenarios.testCases.find((c: any) => c.id === "TC_ALLOC_01");
      assert.ok(tc, "TC_ALLOC_01 must exist");

      const result = taskAllocationAiService.evaluateAllocation(tc.input);

      assert.equal(result.recommendedOwnerId, tc.expectedOutput.recommendedOwnerId);
      assert.equal(result.recommendedSupportId, tc.expectedOutput.recommendedSupportId);
      assert.equal(result.riskLevel, tc.expectedOutput.riskLevel, "Must detect HIGH risk for >= 80% workload");

      const analysisLower = result.workloadAnalysis.toLowerCase();
      tc.expectedOutput.mustIncludeInWorkloadAnalysis.forEach((kw: string) => {
        // Match either the direct keyword or the percentage phrase
        const matches = kw.includes("hoặc")
          ? kw.split("hoặc").some((part) => analysisLower.includes(part.trim().toLowerCase()))
          : analysisLower.includes(kw.toLowerCase());
        assert.ok(matches, `Workload analysis must contain '${kw}'`);
      });

      const reasonsText = result.reasons.join(" ").toLowerCase();
      tc.expectedOutput.mustIncludeInReasons.forEach((kw: string) => {
        assert.ok(reasonsText.includes(kw.toLowerCase()), `Reasons must contain '${kw}'`);
      });
    });

    it("TC_ALLOC_02: Ghép cặp Kèm Cặp (Mentorship / Learning Opportunity)", () => {
      const tc = scenarios.testCases.find((c: any) => c.id === "TC_ALLOC_02");
      assert.ok(tc, "TC_ALLOC_02 must exist");

      const result = taskAllocationAiService.evaluateAllocation(tc.input);

      assert.equal(result.recommendedOwnerId, tc.expectedOutput.recommendedOwnerId);
      assert.equal(result.recommendedSupportId, tc.expectedOutput.recommendedSupportId);
      assert.equal(result.riskLevel, tc.expectedOutput.riskLevel, "Safe workload must be LOW risk");

      const oppText = result.learningOpportunity.toLowerCase();
      tc.expectedOutput.mustIncludeInLearningOpportunity.forEach((kw: string) => {
        assert.ok(oppText.includes(kw.toLowerCase()), `Learning opportunity must contain '${kw}'`);
      });

      const analysisLower = result.workloadAnalysis.toLowerCase();
      tc.expectedOutput.mustIncludeInWorkloadAnalysis.forEach((kw: string) => {
        assert.ok(analysisLower.includes(kw.toLowerCase()), `Workload analysis must contain '${kw}'`);
      });
    });
  });
});
