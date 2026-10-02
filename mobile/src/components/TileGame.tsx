import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/Theme';
import { useSettings } from '../context/Settings';
import { SERIF } from '../theme/fonts';

// 🫀 Memory Match - find matching medical emoji pairs.
// Same pattern as Breathe: inline on the card, tap to expand to fullscreen.

const EMOJIS = ['🫀', '🫁', '🧠', '🦴', '🩺', '💊', '🩸', '🧬', '🩹', '💉', '🧪', '🔬'];

interface Tile {
  id: number;
  emoji: string;
  matched: boolean;
  flipped: boolean;
}

function makeBoard(pairCount: number): Tile[] {
  const picked = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, pairCount);
  const tiles: Tile[] = [];
  picked.forEach((e, i) => {
    tiles.push({ id: i * 2, emoji: e, matched: false, flipped: false });
    tiles.push({ id: i * 2 + 1, emoji: e, matched: false, flipped: false });
  });
  return tiles.sort(() => Math.random() - 0.5);
}

const COLS = 4;

export default function TileGame() {
  const { colors, mode } = useTheme();
  const [tiles, setTiles] = useState<Tile[]>(() => makeBoard(8));
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const lock = useRef(false);
  const { get, set } = useSettings();

  const [big, setBig] = useState(false);
  const insets = useSafeAreaInsets();

  // best scores derive from server settings
  const bestScores = get('tiles_best') as { moves?: number; time?: number } | null;
  const bestMoves = Number(bestScores?.moves) || 0;
  const bestTime = Number(bestScores?.time) || 0;

  const won = moves > 0 && tiles.every((t) => t.matched);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const reset = () => {
    setTiles(makeBoard(8));
    setPicked([]);
    setMoves(0);
    setSeconds(0);
    setRunning(false);
    lock.current = false;
  };

  const flip = (i: number) => {
    if (lock.current) return;
    if (tiles[i].matched || tiles[i].flipped) return;
    if (!running) setRunning(true);
    const nextTiles = tiles.map((t, idx) => (idx === i ? { ...t, flipped: true } : t));
    const nextPicked = [...picked, i];
    setTiles(nextTiles);
    setPicked(nextPicked);
    if (nextPicked.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextPicked;
      if (nextTiles[a].emoji === nextTiles[b].emoji) {
        const finalMoves = moves + 1;
        const willWin = tiles.filter((t) => t.matched).length + 2 === tiles.length;
        setTimeout(() => {
          setTiles((cur) => cur.map((t, idx) => (idx === a || idx === b ? { ...t, matched: true } : t)));
          setPicked([]);
          if (willWin) {
            setRunning(false);
            if (bestMoves === 0 || finalMoves < bestMoves) {
              set('tiles_best', { moves: finalMoves, time: bestTime });
            }
            if (bestTime === 0 || seconds < bestTime) {
              set('tiles_best', { moves: bestMoves, time: seconds });
            }
          }
        }, 320);
      } else {
        lock.current = true;
        setTimeout(() => {
          setTiles((cur) => cur.map((t, idx) => (idx === a || idx === b ? { ...t, flipped: false } : t)));
          setPicked([]);
          lock.current = false;
        }, 720);
      }
    }
  };

  const matchedBg = mode === 'dark' ? '#234034' : '#d9e6dd';
  const tintGreen = mode === 'dark' ? { backgroundColor: '#16241c', borderColor: '#234034' } : { backgroundColor: '#eaf1ec', borderColor: '#cfe0d4' };

  const renderCell = (t: Tile, i: number, size: number) => {
    const faceDown = !t.flipped && !t.matched;
    const bg = faceDown ? colors.forest : t.matched ? matchedBg : colors.card;
    const border = faceDown || t.matched ? colors.forest : colors.line;
    return (
      <Pressable
        key={t.id}
        onPress={() => flip(i)}
        style={({ pressed }) => [
          styles.cell,
          {
            width: size,
            height: size,
            backgroundColor: bg,
            borderColor: border,
            opacity: t.matched ? 0.5 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Text style={{ fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.6) }}>
          {faceDown ? '' : t.emoji}
        </Text>
        {faceDown && <Text style={[styles.cellGhost, { fontSize: Math.round(size * 0.28) }]}>🩺</Text>}
      </Pressable>
    );
  };

  const renderBoard = (cellSize: number, gap: number) => (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
        width: COLS * cellSize + (COLS - 1) * gap,
      }}
    >
      {tiles.map((t, i) => renderCell(t, i, cellSize))}
    </View>
  );

  const renderStats = (inline: boolean) => (
    <View
      style={[
        styles.stats,
        { marginTop: inline ? 4 : 0, marginBottom: inline ? 0 : 12 },
      ]}
    >
      <Text style={[styles.statsText, { color: colors.muted, fontSize: inline ? 11.5 : 13 }]}>⏱ {seconds}s</Text>
      <Text style={[styles.statsText, { color: colors.muted, fontSize: inline ? 11.5 : 13 }]}>🎯 {moves}</Text>
      {!inline && bestMoves > 0 && (
        <Text style={[styles.statsText, { color: colors.muted, fontSize: 13, opacity: 0.8 }]}>
          ★ {bestMoves}m · {bestTime}s
        </Text>
      )}
    </View>
  );

  const winModal = (
    <View style={styles.winOverlay}>
      <View style={[styles.winCard, { backgroundColor: colors.card }]}>
        <Text style={{ fontSize: 46, marginBottom: 4 }}>🎉</Text>
        <Text style={[styles.winTitle, { color: colors.forest }]}>Matched!</Text>
        <Text style={[styles.winSub, { color: colors.muted }]}>
          {moves} moves · {seconds}s
        </Text>
        {(moves === bestMoves || seconds === bestTime) && (
          <Text style={[styles.winBest, { color: colors.gold }]}>⭐ New best!</Text>
        )}
        <View style={styles.winBtns}>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [styles.winBtn, { backgroundColor: colors.forest, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.winBtnText, { color: colors.paper }]}>Play again</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setBig(false);
              reset();
            }}
            style={({ pressed }) => [
              styles.winBtn,
              styles.winBtnGhost,
              { borderColor: colors.forest, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.winBtnText, { color: colors.forest }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (big) {
    const { width, height } = Dimensions.get('window');
    const boardArea = Math.min(width - 32, height - 200);
    const cellSize = Math.floor((boardArea - (COLS - 1) * 10) / COLS);

    return (
      <Modal visible animationType="fade" onRequestClose={() => setBig(false)}>
        <View style={[styles.fs, { backgroundColor: colors.paper, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.fsHeader}>
            <Pressable
              onPress={reset}
              style={({ pressed }) => [
                styles.restartBtn,
                { borderColor: colors.line, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.restartText, { color: colors.ink }]}>↻ Restart</Text>
            </Pressable>
            <Text style={[styles.fsTitle, { color: colors.forest }]}>Memory Match</Text>
            <Pressable
              onPress={() => setBig(false)}
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 1 : 0.5 }]}
            >
              <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
            </Pressable>
          </View>

          {renderStats(false)}

          <View style={styles.fsBoardArea}>{renderBoard(cellSize, 10)}</View>

          {won && winModal}
        </View>
      </Modal>
    );
  }

  const inlineCell = 52;
  return (
    <Pressable onPress={() => setBig(true)} style={[styles.card, tintGreen]}>
      <Text style={[styles.cardVoice, { color: colors.muted }]}>A 60-second brain reset. Find the pairs.</Text>
      <Text style={[styles.cardSub, { color: colors.muted }]}>Tap tiles to play · tap card edges for full-screen</Text>

      <Pressable onPress={() => {}} style={styles.inlineBoard}>
        {renderBoard(inlineCell, 8)}
      </Pressable>

      {renderStats(true)}

      {won ? (
        <Pressable onPress={() => {}} style={{ alignItems: 'center' }}>
          <Text style={[styles.inlineWin, { color: colors.forest }]}>
            🎉 Matched! {moves} moves · {seconds}s
          </Text>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [
              styles.playAgain,
              { borderColor: colors.forest, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: colors.forest, fontSize: 15, fontWeight: '600' }}>Play again</Text>
          </Pressable>
        </Pressable>
      ) : (
        bestMoves > 0 && (
          <Text style={[styles.bestLine, { color: colors.muted }]}>
            Best: {bestMoves} moves · {bestTime}s
          </Text>
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  cardVoice: { fontFamily: SERIF, fontSize: 14, marginTop: 2, textAlign: 'center' },
  cardSub: { fontSize: 11, marginTop: 6, textAlign: 'center' },
  inlineBoard: { marginTop: 12, marginBottom: 6 },
  cell: {
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellGhost: { position: 'absolute', opacity: 0.18 },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  statsText: { fontWeight: '600' },
  inlineWin: { fontSize: 13, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  playAgain: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  bestLine: { fontSize: 10.5, marginTop: 4, opacity: 0.75, textAlign: 'center' },
  fs: { flex: 1, paddingHorizontal: 16 },
  fsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  restartBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  restartText: { fontWeight: '700', fontSize: 12.5 },
  fsTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fsBoardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  winOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(31, 77, 63, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  winCard: { borderRadius: 18, paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', width: '100%', maxWidth: 320 },
  winTitle: { fontFamily: SERIF, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  winSub: { fontSize: 13.5, marginBottom: 16 },
  winBest: { fontSize: 12, fontWeight: '700', marginBottom: 12 },
  winBtns: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  winBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  winBtnGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  winBtnText: { fontSize: 15, fontWeight: '600' },
});
