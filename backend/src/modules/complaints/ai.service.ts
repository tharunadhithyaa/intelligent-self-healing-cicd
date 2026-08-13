import { randomInt } from "node:crypto";
import Complaint, { ComplaintCategory } from "../../models/complaint.model";

export interface AIAnalysisResult {
  category: ComplaintCategory;
  priority: "low" | "medium" | "high" | "critical";
  department: string;
  duplicateDetected: boolean;
  duplicateWarning?: string;
  summary: string;
  confidenceScore: number;
}

class AIService {
  private readonly categoryKeywords: Record<ComplaintCategory, string[]> = {
    "Road Damage": [
      "pothole",
      "road",
      "asphalt",
      "cracks",
      "street",
      "pavement",
      "highway",
      "sinkhole",
      "tar",
    ],
    "Garbage Management": [
      "garbage",
      "trash",
      "waste",
      "litter",
      "dump",
      "bin",
      "refuse",
      "dirty",
      "odor",
      "smell",
      "plastic",
    ],
    "Streetlight Issue": [
      "streetlight",
      "light",
      "lamp",
      "dark",
      "bulb",
      "flicker",
      "broken pole",
      "lighting",
    ],
    "Water Supply": [
      "water",
      "leak",
      "pipe",
      "burst",
      "no water",
      "supply",
      "tap",
      "pressure",
      "dirty water",
      "contamination",
    ],
    "Drainage Problem": [
      "drain",
      "clog",
      "sewage",
      "overflow",
      "gutter",
      "flooding",
      "blocked",
      "stagnant",
      "manhole",
    ],
    Drainage: [
      "drain",
      "clog",
      "sewage",
      "overflow",
      "gutter",
      "flooding",
    ],
    "Traffic Issue": [
      "traffic",
      "signal",
      "congestion",
      "intersection",
      "junction",
      "signage",
      "parking",
      "gridlock",
      "roadblock",
    ],
    "Public Safety": [
      "safety",
      "hazard",
      "stray dog",
      "broken glass",
      "danger",
      "lighting",
      "vandalism",
      "open wire",
      "suspicious",
    ],
    "Electricity Issue": [
      "electricity",
      "power",
      "blackout",
      "outage",
      "wire",
      "transformer",
      "shock",
      "short circuit",
      "voltage",
    ],
    Other: [],
  };

  private readonly departmentMapping: Record<ComplaintCategory, string> = {
    "Road Damage": "Public Works Department (PWD)",
    "Garbage Management": "Municipal Solid Waste & Sanitation Division",
    "Streetlight Issue": "Electrical & Streetlighting Agency",
    "Water Supply": "Water Supply & Sewerage Board (WSSB)",
    "Drainage Problem": "Sanitation & Sewerage Maintenance Division",
    Drainage: "Sanitation & Sewerage Maintenance Division",
    "Traffic Issue": "Traffic Police & Transit Management Authorities",
    "Public Safety": "Community Safety & Civil Defense Department",
    "Electricity Issue": "State Power Distribution & Grid Corp",
    Other: "General Public Services Administration",
  };

  /**
   * Run full AI analysis on draft complaint details
   */
  async analyzeComplaint(
    title: string,
    description: string,
    location: { latitude: number; longitude: number; address: string },
  ): Promise<AIAnalysisResult> {
    const combinedText = `${title} ${description}`.toLowerCase();

    // 1. Predict Category
    const predictedCategory = this.predictCategory(combinedText);

    // 2. Predict Priority
    const predictedPriority = this.predictPriority(combinedText);

    // 3. Recommend Department
    const recommendedDept = this.departmentMapping[predictedCategory];

    // 4. Summarize Description
    const summary = this.generateSummary(
      title,
      predictedCategory,
      location.address,
    );

    // 5. Calculate overall confidence score (mocking dynamic variance)
    const confidenceScore = randomInt(80, 95); // between 80% and 95%

    // 6. Duplicate Complaint Detection
    const duplicate = await this.detectDuplicate(
      predictedCategory,
      location,
      description,
    );

    return {
      category: predictedCategory,
      priority: predictedPriority,
      department: recommendedDept,
      duplicateDetected: duplicate.detected,
      duplicateWarning: duplicate.warning,
      summary,
      confidenceScore,
    };
  }

  private predictCategory(text: string): ComplaintCategory {
    let bestCategory: ComplaintCategory = "Other";
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (category === "Other") continue;

      let matches = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matches++;
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category as ComplaintCategory;
      }
    }

    return bestCategory;
  }

  private predictPriority(
    text: string,
  ): "low" | "medium" | "high" | "critical" {
    const criticalKeywords = [
      "danger",
      "hazard",
      "fire",
      "shock",
      "live wire",
      "accident",
      "injury",
      "collapse",
      "flooding",
      "blocked road",
      "critical",
    ];
    const highKeywords = [
      "broken",
      "leak",
      "burst",
      "overflow",
      "foul smell",
      "traffic jam",
      "darkness",
      "unsafe",
    ];
    const mediumKeywords = [
      "pothole",
      "garbage",
      "trash",
      "litter",
      "flicker",
      "delay",
    ];

    for (const kw of criticalKeywords) {
      if (text.includes(kw)) return "critical";
    }
    for (const kw of highKeywords) {
      if (text.includes(kw)) return "high";
    }
    for (const kw of mediumKeywords) {
      if (text.includes(kw)) return "medium";
    }
    return "low";
  }

  private generateSummary(
    title: string,
    category: ComplaintCategory,
    address: string,
  ): string {
    const cleanTitle = title.trim();
    // Trim the end punctuation if any
    const heading = cleanTitle.endsWith(".")
      ? cleanTitle.slice(0, -1)
      : cleanTitle;
    return `Issue regarding '${category}' reported near ${address}. Summary: ${heading}.`;
  }

  public async detectDuplicates(
    category: ComplaintCategory,
    location: { latitude: number; longitude: number },
    description: string,
  ): Promise<{ detected: boolean; warning?: string }> {
    return this.detectDuplicate(category, location, description);
  }

  private async detectDuplicate(
    category: ComplaintCategory,
    location: { latitude: number; longitude: number },
    description: string,
  ): Promise<{ detected: boolean; warning?: string }> {
    // Look for active complaints in the same category within the last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const complaints = await Complaint.find({
      category,
      status: { $ne: "closed" },
      createdAt: { $gte: threeDaysAgo },
    }).select("location description title");

    // Find nearby complaints (within approximately 500 meters)
    // 1 degree of latitude/longitude is ~111km, so 500 meters is ~0.0045 degrees
    const distanceThreshold = 0.0045;

    for (const item of complaints) {
      const latDiff = Math.abs(item.location.latitude - location.latitude);
      const lonDiff = Math.abs(item.location.longitude - location.longitude);

      if (latDiff <= distanceThreshold && lonDiff <= distanceThreshold) {
        // Compute basic description overlap (Jaccard similarity on word levels)
        const desc1Words = new Set(
          description
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3),
        );
        const desc2Words = new Set(
          item.description
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3),
        );

        if (desc1Words.size > 0 && desc2Words.size > 0) {
          const intersection = new Set(
            [...desc1Words].filter((x) => desc2Words.has(x)),
          );
          const union = new Set([...desc1Words, ...desc2Words]);
          const similarity = intersection.size / union.size;

          if (similarity >= 0.25) {
            // 25% similar vocabulary
            return {
              detected: true,
              warning: `A similar issue ("${item.title}") has already been reported nearby. Our response team might already be on it!`,
            };
          }
        }
      }
    }

    return { detected: false };
  }
}

export const aiService = new AIService();
