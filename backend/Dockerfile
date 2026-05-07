FROM golang:1.24-alpine AS build
WORKDIR /src

COPY go.mod ./
RUN go mod download

COPY . .
RUN go build -o /out/messenger ./main.go

FROM alpine:3.21
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /out/messenger /app/messenger

RUN mkdir -p /app/uploads && chown -R app:app /app
USER app

EXPOSE 8080
CMD ["/app/messenger"]
