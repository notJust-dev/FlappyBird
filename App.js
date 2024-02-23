import { Alert, Platform, useWindowDimensions } from 'react-native';
import {
  Canvas,
  useImage,
  Image,
  rotate,
  Group,
  Fill,
  Text,
  matchFont,
  Circle,
  Rect,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  Easing,
  withSequence,
  withRepeat,
  useFrameCallback,
  useDerivedValue,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';

const GRAVITY = 1000;
const JUMP_FORCE = -500;

const pipeWidth = 104;
const pipeHeight = 640;

const App = () => {
  const { width, height } = useWindowDimensions();
  const [score, setScore] = useState(0);

  const bg = useImage(require('./assets/sprites/background-day.png'));
  const bird = useImage(require('./assets/sprites/yellowbird-upflap.png'));
  const pipeBottom = useImage(require('./assets/sprites/pipe-green.png'));
  const pipeTop = useImage(require('./assets/sprites/pipe-green-top.png'));
  const base = useImage(require('./assets/sprites/base.png'));

  const gameOver = useSharedValue(false);
  const x = useSharedValue(width);

  const birdY = useSharedValue(height / 3);
  const birdPos = {
    x: width / 4,
  };
  const birdYVelocity = useSharedValue(0);

  const birdCenterX = useDerivedValue(() => birdPos.x + 32);
  const birdCenterY = useDerivedValue(() => birdY.value + 24);
  const pipeOffset = 0;
  const obstacles = useDerivedValue(() => {
    const allObstacles = [];
    // add bottom pipe
    allObstacles.push({
      x: x.value,
      y: height - 320 + pipeOffset,
      h: pipeHeight,
      w: pipeWidth,
    });

    // add top pipe
    allObstacles.push({
      x: x.value,
      y: pipeOffset - 320,
      h: pipeHeight,
      w: pipeWidth,
    });

    return allObstacles;
  });

  useEffect(() => {
    moveTheMap();
  }, []);

  const moveTheMap = () => {
    x.value = withRepeat(
      withSequence(
        withTiming(-150, { duration: 3000, easing: Easing.linear }),
        withTiming(width, { duration: 0 })
      ),
      -1
    );
  };

  // Scoring system
  useAnimatedReaction(
    () => x.value,
    (currentValue, previousValue) => {
      const middle = birdPos.x;

      if (
        currentValue !== previousValue &&
        previousValue &&
        currentValue <= middle &&
        previousValue > middle
      ) {
        // do something ✨
        runOnJS(setScore)(score + 1);
      }
    }
  );

  const isPointCollidingWithRect = (point, rect) => {
    'worklet';
    return (
      point.x >= rect.x && // right of the left edge AND
      point.x <= rect.x + rect.w && // left of the right edge AND
      point.y >= rect.y && // below the top AND
      point.y <= rect.y + rect.h // above the bottom
    );
  };

  // Collision detection
  useAnimatedReaction(
    () => birdY.value,
    (currentValue, previousValue) => {
      // Ground collision detection
      if (currentValue > height - 100 || currentValue < 0) {
        gameOver.value = true;
      }

      const isColliding = obstacles.value.some((rect) =>
        isPointCollidingWithRect(
          { x: birdCenterX.value, y: birdCenterY.value },
          rect
        )
      );
      if (isColliding) {
        gameOver.value = true;
      }
    }
  );

  useAnimatedReaction(
    () => gameOver.value,
    (currentValue, previousValue) => {
      if (currentValue && !previousValue) {
        cancelAnimation(x);
      }
    }
  );

  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    if (!dt || gameOver.value) {
      return;
    }
    birdY.value = birdY.value + (birdYVelocity.value * dt) / 1000;
    birdYVelocity.value = birdYVelocity.value + (GRAVITY * dt) / 1000;
  });

  const restartGame = () => {
    'worklet';
    birdY.value = height / 3;
    birdYVelocity.value = 0;
    gameOver.value = false;
    x.value = width;
    runOnJS(moveTheMap)();
    runOnJS(setScore)(0);
  };

  const gesture = Gesture.Tap().onStart(() => {
    if (gameOver.value) {
      // restart
      restartGame();
    } else {
      // jump
      birdYVelocity.value = JUMP_FORCE;
    }
  });

  const birdTransform = useDerivedValue(() => {
    return [
      {
        rotate: interpolate(
          birdYVelocity.value,
          [-500, 500],
          [-0.5, 0.5],
          Extrapolation.CLAMP
        ),
      },
    ];
  });
  const birdOrigin = useDerivedValue(() => {
    return { x: width / 4 + 32, y: birdY.value + 24 };
  });

  const fontFamily = Platform.select({ ios: 'Helvetica', default: 'serif' });
  const fontStyle = {
    fontFamily,
    fontSize: 40,
    fontWeight: 'bold',
  };
  const font = matchFont(fontStyle);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height }}>
          {/* BG */}
          <Image image={bg} width={width} height={height} fit={'cover'} />

          {/* Pipes */}
          <Image
            image={pipeTop}
            y={pipeOffset - 320}
            x={x}
            width={pipeWidth}
            height={pipeHeight}
          />
          <Image
            image={pipeBottom}
            y={height - 320 + pipeOffset}
            x={x}
            width={pipeWidth}
            height={pipeHeight}
          />

          {/* Base */}
          <Image
            image={base}
            width={width}
            height={150}
            y={height - 75}
            x={0}
            fit={'cover'}
          />

          {/* Bird */}
          <Group transform={birdTransform} origin={birdOrigin}>
            <Image
              image={bird}
              y={birdY}
              x={birdPos.x}
              width={64}
              height={48}
            />
          </Group>

          {/* Sim */}
          {/* <Circle cy={birdCenterY} cx={birdCenterX} r={15} color={'red'} /> */}

          {/* Score */}
          <Text
            x={width / 2 - 30}
            y={100}
            text={score.toString()}
            font={font}
          />
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};
export default App;
