# AWS Lambda 컨테이너 이미지 — NestJS 앱을 서버리스로 배포함
# 멀티스테이지: builder 에서 빌드 후 런타임 이미지에 산출물만 복사

FROM public.ecr.aws/lambda/nodejs:22 AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM public.ecr.aws/lambda/nodejs:22
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
# dist/lambda.js 의 named export 'handler'
CMD ["dist/lambda.handler"]
