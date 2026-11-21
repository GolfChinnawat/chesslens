# Move classification

`src/analysis/classificationConfig.ts` contains the tunable thresholds.
Grades are derived from saved Phase 2 evaluations when the review opens.
The existing review cache does not need migration.

## Win model and accuracy

Stockfish scores are stored from White's perspective. Before grading, both
scores are converted to the mover's perspective. The pre-move score comes
from the engine's first line and the post-move score comes from the actual
position reached. The model maps mate in N to signed `10000 - N` cp,
including the winning side of an on-board checkmate.

```
win = 50 + 50 × (2 / (1 + exp(-0.00368208 × cp)) - 1)
loss = max(0, winBefore - winAfter)
accuracy = clamp(103.1668 × exp(-0.04354 × loss) - 3.1669, 0, 100)
```

Player accuracy is the arithmetic mean of their non-forced move accuracies,
including Book moves. The game rating is a display estimate computed from
at least five graded moves: `400 + (2800 - 400) × (accuracy / 100)^1.8`,
rounded to the nearest integer. It uses no opponent rating or match history.

## Class rules

1. Exactly one legal move is **Forced** and excluded from accuracy.
2. **Book** matches an opening position, including prefixes and transpositions,
   in the first 16 plies of games starting at the standard FEN. The table uses
   one shortest line per ECO from the [Lichess opening dataset](https://github.com/lichess-org/chess-openings)
   under CC0. The FEN key uses piece placement, turn, castling and en passant.
   When several records share a position, one representative name is shown.
3. **Best** is the top engine move or a loss at most 0.3 percentage points.
4. In already-decided positions, scores both above 97% or both below 3%
   are graded **Good** when the move is not already **Best**.
5. **Miss** requires the immediately preceding opponent move to be
   **Mistake** or **Blunder**, at least 70% pre-move win score, and a loss
   of at least 10 points. A top engine move cannot be **Miss**.
6. Remaining losses at most 2, 5, 10, and 20 points are **Excellent**,
   **Good**, **Inaccuracy**, and **Mistake**. Greater losses are **Blunder**.

## Tactical upgrades

**Great** upgrades the engine's top move if it beats the second line by
at least 10 points or crosses a result bracket relative to it (35% and
65% boundaries). Obvious recaptures and positions above 90% are excluded.

**Brilliant** takes precedence over Great. It upgrades a Best or Excellent
move after ply 8 when the loss is at most 2 points, pre-move win score is
at most 80%, and post-move win score is at least 50%. It excludes obvious
recaptures and check-escaping captures that lead the alternative by at least
25 points. The played move must have an engine continuation where, over
the next three plies, the opponent takes a non-pawn piece and the mover
ends up at least two pawns worse in net material. Pawn exchanges and equal
recaptures do not qualify.

Brilliant and Great are ChessLens approximations. Chess.com's exact
algorithm is not public. The estimates can vary with engine depth, available
PV lines, and the size of the opening table.

## Retry

Retry opens the position before the selected mistake. Stockfish analyzes the
legal alternative with the original game history and selected review depth.
The review and its saved evaluations remain intact.
